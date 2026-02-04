import { IExecuteFunctions, NodeOperationError, IDataObject } from 'n8n-workflow';
import * as path from 'path';
import ffmpeg = require('fluent-ffmpeg');
import { getTempFile, runFfmpeg, getAvailableFonts } from '../utils';
import * as fs from 'fs-extra';

// Map FFmpeg format names to file extensions
const FORMAT_TO_EXTENSION: Record<string, string> = {
	'jpeg_pipe': '.jpg',
	'png_pipe': '.png',
	'gif_pipe': '.gif',
	'webp_pipe': '.webp',
	'bmp_pipe': '.bmp',
	'tiff_pipe': '.tiff',
	'image2': '.jpg', // Default for generic image format
};

// Get the actual image format using ffprobe
function detectImageFormat(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(filePath, (err, metadata) => {
			if (err) {
				return reject(new Error(`Failed to probe image: ${err.message}`));
			}
			const formatName = metadata.format.format_name || '';
			const extension = FORMAT_TO_EXTENSION[formatName] || '.jpg';
			resolve(extension);
		});
	});
}

// Get image dimensions using ffprobe
function getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(filePath, (err, metadata) => {
			if (err) {
				return reject(new Error(`Failed to probe image: ${err.message}`));
			}
			const videoStream = metadata.streams.find(s => s.codec_type === 'video');
			if (!videoStream || !videoStream.width || !videoStream.height) {
				return reject(new Error('Could not determine image dimensions'));
			}
			resolve({ width: videoStream.width, height: videoStream.height });
		});
	});
}

// Calculate effective text length considering character widths
// Korean/CJK characters are roughly 2x width of Latin characters
function calculateEffectiveTextLength(text: string): number {
	let length = 0;
	for (const char of text) {
		const code = char.charCodeAt(0);
		// CJK characters (Korean, Chinese, Japanese)
		if (
			(code >= 0xAC00 && code <= 0xD7AF) || // Korean Hangul
			(code >= 0x3130 && code <= 0x318F) || // Korean Jamo
			(code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
			(code >= 0x3040 && code <= 0x309F) || // Hiragana
			(code >= 0x30A0 && code <= 0x30FF)    // Katakana
		) {
			length += 1.8; // CJK characters are wider
		} else if (char === '\n') {
			// Newlines don't contribute to width
			length += 0;
		} else {
			length += 1; // Latin and other characters
		}
	}
	return length;
}

// Remove emojis from text (emojis cause rendering issues with most fonts)
function removeEmojis(text: string): string {
	// Comprehensive emoji regex pattern covering:
	// - Emoticons, Dingbats, Symbols
	// - Transport, Map, Alchemical symbols
	// - Flags, Skin tone modifiers
	// - ZWJ sequences, Variation selectors
	const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2B55}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]/gu;

	// Remove emojis and clean up any resulting double spaces (but preserve newlines)
	return text
		.replace(emojiPattern, '')
		.split('\n')
		.map(line => line.replace(/  +/g, ' ').trim())
		.join('\n');
}

// Calculate auto font size based on image dimensions and text
function calculateAutoFontSize(
	imageWidth: number,
	imageHeight: number,
	text: string,
	sizeOption: string, // 'auto-small', 'auto-medium', 'auto-large'
	paddingX: number = 20
): number {
	// Split by newlines and find the longest line
	const lines = text.split('\n');
	let maxLineLength = 0;
	for (const line of lines) {
		const lineLength = calculateEffectiveTextLength(line);
		if (lineLength > maxLineLength) {
			maxLineLength = lineLength;
		}
	}

	// If empty or only newlines, use a default
	if (maxLineLength === 0) {
		maxLineLength = 1;
	}

	// Available width (with padding on both sides)
	const availableWidth = imageWidth - (paddingX * 2);

	// Base calculation: fit text within available width
	// Approximate: 1 character ≈ 0.6 * fontSize in width for most fonts
	const charWidthRatio = 0.55;
	let baseFontSize = availableWidth / (maxLineLength * charWidthRatio);

	// Apply size multiplier
	const sizeMultipliers: Record<string, number> = {
		'auto-small': 0.5,
		'auto-medium': 0.75,
		'auto-large': 1.0,
		'auto-xlarge': 1.1,
		'auto-huge': 1.2,
		'auto-max': 1.3,
	};
	const multiplier = sizeMultipliers[sizeOption] || 0.75;
	let fontSize = Math.floor(baseFontSize * multiplier);

	// Also consider height constraint (text shouldn't be taller than 80% of image)
	const lineCount = lines.length;
	const maxHeightFontSize = Math.floor((imageHeight * 0.8) / (lineCount * 1.2)); // 1.2 for line spacing
	fontSize = Math.min(fontSize, maxHeightFontSize);

	// Clamp to reasonable range
	fontSize = Math.max(12, Math.min(fontSize, 500));

	return fontSize;
}

export async function executeAddTextToImage(
	this: IExecuteFunctions,
	imagePath: string,
	text: string,
	options: IDataObject,
	itemIndex: number,
): Promise<string> {
	// Get font (includes bundled, user, and system fonts)
	const allFonts = getAvailableFonts(true);
	const fontKey = (options.fontKey as string) || 'noto-sans-kr';
	const font = allFonts[fontKey] as IDataObject | undefined;

	if (!font || !font.path) {
		throw new NodeOperationError(
			this.getNode(),
			`Selected font '${fontKey}' is not valid or its file path is missing.`,
			{ itemIndex },
		);
	}

	const fontPath = font.path as string;

	// Remove emojis from text (they cause rendering issues with most fonts)
	const cleanedText = removeEmojis(text);

	// Get padding values early (needed for auto font size calculation)
	const paddingX = (options.paddingX as number) ?? 20;
	const paddingY = (options.paddingY as number) ?? 20;

	// Handle font size - support auto sizing options
	let fontSize: number;
	const sizeOption = options.size;
	const autoSizeOptions = ['auto-small', 'auto-medium', 'auto-large', 'auto-xlarge', 'auto-huge', 'auto-max'];

	if (typeof sizeOption === 'string' && autoSizeOptions.includes(sizeOption)) {
		// Auto font size - need to get image dimensions first
		const dimensions = await getImageDimensions(imagePath);
		fontSize = calculateAutoFontSize(
			dimensions.width,
			dimensions.height,
			cleanedText,
			sizeOption,
			paddingX
		);
	} else {
		fontSize = (sizeOption as number) || 48;
	}

	const fontColor = options.color || 'white';
	const lineSpacing = (options.lineSpacing as number) ?? 10;
	const horizontalAlign = (options.horizontalAlign as string) || 'center';

	// Line-specific colors
	const enableLineColors = options.enableLineColors || false;
	const line1Color = (options.line1Color as string) || fontColor;
	const line2Color = (options.line2Color as string) || fontColor;

	// Outline options
	const outlineWidth = options.outlineWidth || 0;
	const outlineColor = options.outlineColor || 'black';

	// Background box options
	const enableBackground = options.enableBackground || false;
	const backgroundColor = options.backgroundColor || 'black';
	const backgroundOpacity = options.backgroundOpacity ?? 0.5;
	const boxPadding = options.boxPadding || 5;

	// Determine output extension - detect actual format if input has .tmp extension
	let outputExt = path.extname(imagePath).toLowerCase();
	const knownImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
	if (!knownImageExtensions.includes(outputExt)) {
		// Input has unknown extension (e.g., .tmp from URL download), detect actual format
		try {
			outputExt = await detectImageFormat(imagePath);
		} catch {
			// Fallback to .jpg if detection fails
			outputExt = '.jpg';
		}
	}
	const outputPath = getTempFile(outputExt);

	// Split text into lines for multi-line center alignment support
	const lines = cleanedText.split('\n').filter(line => line.length > 0);

	// Calculate line height (fontSize + lineSpacing)
	const lineHeight = fontSize + lineSpacing;
	const totalTextHeight = lines.length * fontSize + (lines.length - 1) * lineSpacing;

	// Build drawtext filters - one for each line
	const drawtextFilters: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const escapedLine = line.replace(/'/g, `''`);

		// Determine color for this line
		let lineColor = fontColor;
		if (enableLineColors) {
			if (i === 0) {
				lineColor = line1Color;
			} else if (i === 1) {
				lineColor = line2Color;
			} else {
				// Lines 3+ use Line 1 color
				lineColor = line1Color;
			}
		}

		// Calculate X position based on horizontal alignment
		let lineX: string;
		switch (horizontalAlign) {
			case 'left':
				lineX = `${paddingX}`;
				break;
			case 'right':
				lineX = `w-text_w-${paddingX}`;
				break;
			case 'center':
			default:
				lineX = '(w-text_w)/2';
				break;
		}

		// Calculate Y position for this line
		// Base Y from vertical alignment, then offset by line index
		let lineY: string;
		const verticalAlign = (options.verticalAlign as string) || 'middle';
		const lineOffset = i * lineHeight;

		switch (verticalAlign) {
			case 'top':
				lineY = `${paddingY + lineOffset}`;
				break;
			case 'bottom':
				// Start from bottom, going up for total height, then down for each line
				lineY = `h-${paddingY + totalTextHeight - lineOffset}`;
				break;
			case 'middle':
			default:
				// Center vertically, then offset each line
				lineY = `(h-${totalTextHeight})/2+${lineOffset}`;
				break;
		}

		// Build drawtext for this line
		let drawtext = `drawtext=fontfile=${fontPath}:text='${escapedLine}':fontsize=${fontSize}:fontcolor=${lineColor}:x=${lineX}:y=${lineY}`;

		// Add outline (border) if width > 0
		if (outlineWidth > 0) {
			drawtext += `:borderw=${outlineWidth}:bordercolor=${outlineColor}`;
		}

		// Add background box if enabled
		if (enableBackground) {
			drawtext += `:box=1:boxcolor=${backgroundColor}@${backgroundOpacity}:boxborderw=${boxPadding}`;
		}

		drawtextFilters.push(drawtext);
	}

	// If no lines (empty text), create a single empty filter to avoid errors
	if (drawtextFilters.length === 0) {
		drawtextFilters.push(`drawtext=fontfile=${fontPath}:text='':fontsize=${fontSize}:fontcolor=${fontColor}:x=0:y=0`);
	}

	const command = ffmpeg(imagePath)
		.videoFilters(drawtextFilters)
		.frames(1)
		.save(outputPath);

	try {
		await runFfmpeg(command);
		return outputPath;
	} catch (error) {
		// Clean up output file if creation failed
		await fs.remove(outputPath).catch(() => {});
		throw new NodeOperationError(
			this.getNode(),
			`Error adding text to image. FFmpeg error: ${(error as Error).message}`,
			{ itemIndex },
		);
	}
}
