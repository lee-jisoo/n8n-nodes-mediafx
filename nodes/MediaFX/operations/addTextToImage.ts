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

function getPositionFromAlignment(
	horizontalAlign: string,
	verticalAlign: string,
	paddingX: number,
	paddingY: number
): { x: string; y: string } {
	let x: string;
	let y: string;

	// Set X position based on horizontal alignment
	switch (horizontalAlign) {
		case 'left':
			x = `${paddingX}`;
			break;
		case 'right':
			x = `w-text_w-${paddingX}`;
			break;
		case 'center':
		default:
			x = '(w-text_w)/2';
			break;
	}

	// Set Y position based on vertical alignment
	switch (verticalAlign) {
		case 'top':
			y = `${paddingY}`;
			break;
		case 'bottom':
			y = `h-th-${paddingY}`;
			break;
		case 'middle':
		default:
			y = '(h-text_h)/2';
			break;
	}

	return { x, y };
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

	// Set default values for text options
	const fontSize = options.size || 48;
	const fontColor = options.color || 'white';

	// Outline options
	const outlineWidth = options.outlineWidth || 0;
	const outlineColor = options.outlineColor || 'black';

	// Background box options
	const enableBackground = options.enableBackground || false;
	const backgroundColor = options.backgroundColor || 'black';
	const backgroundOpacity = options.backgroundOpacity ?? 0.5;
	const boxPadding = options.boxPadding || 5;

	// Handle position based on position type
	let positionX: string;
	let positionY: string;

	const positionType = options.positionType || 'alignment';

	if (positionType === 'alignment') {
		const horizontalAlign = (options.horizontalAlign as string) || 'center';
		const verticalAlign = (options.verticalAlign as string) || 'middle';
		const paddingX = (options.paddingX as number) ?? 20;
		const paddingY = (options.paddingY as number) ?? 20;

		const position = getPositionFromAlignment(horizontalAlign, verticalAlign, paddingX, paddingY);
		positionX = position.x;
		positionY = position.y;
	} else {
		// Custom position
		positionX = (options.x as string) || '(w-text_w)/2';
		positionY = (options.y as string) || '(h-text_h)/2';
	}

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

	// Escape single quotes in text
	const escapedText = text.replace(/'/g, `''`);

	// Build drawtext filter
	let drawtext = `drawtext=fontfile=${fontPath}:text='${escapedText}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${positionX}:y=${positionY}`;

	// Add outline (border) if width > 0
	if (outlineWidth > 0) {
		drawtext += `:borderw=${outlineWidth}:bordercolor=${outlineColor}`;
	}

	// Add background box if enabled
	if (enableBackground) {
		drawtext += `:box=1:boxcolor=${backgroundColor}@${backgroundOpacity}:boxborderw=${boxPadding}`;
	}

	const command = ffmpeg(imagePath)
		.videoFilters(drawtext)
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
