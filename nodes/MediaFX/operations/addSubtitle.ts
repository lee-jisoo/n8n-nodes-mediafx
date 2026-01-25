import { IExecuteFunctions, NodeOperationError, IDataObject } from 'n8n-workflow';
import * as path from 'path';
import * as fs from 'fs-extra';
import ffmpeg = require('fluent-ffmpeg');
import { getTempFile, runFfmpeg, getAvailableFonts } from '../utils';

/**
 * Escape special characters in file path for FFmpeg subtitles filter.
 */
function escapeSubtitlePath(filePath: string): string {
	return filePath
		.replace(/\\/g, '\\\\\\\\')
		.replace(/:/g, '\\:')
		.replace(/\[/g, '\\[')
		.replace(/\]/g, '\\]')
		.replace(/'/g, "\\'");
}

/**
 * Convert color to ASS format (&HAABBGGRR)
 * @param color - CSS color (hex #RRGGBB or named color)
 * @param opacity - Opacity 0-1 (0=transparent, 1=solid)
 */
function colorToASS(color: string, opacity: number = 1): string {
	let r = 'FF', g = 'FF', b = 'FF';
	
	if (color && color.startsWith('#') && color.length === 7) {
		r = color.substring(1, 3);
		g = color.substring(3, 5);
		b = color.substring(5, 7);
	} else {
		const namedColors: Record<string, string> = {
			white: 'FFFFFF',
			black: '000000',
			red: 'FF0000',
			green: '00FF00',
			blue: '0000FF',
			yellow: 'FFFF00',
			cyan: '00FFFF',
			magenta: 'FF00FF',
			orange: 'FFA500',
		};
		const hex = namedColors[color.toLowerCase()] || 'FFFFFF';
		r = hex.substring(0, 2);
		g = hex.substring(2, 4);
		b = hex.substring(4, 6);
	}
	
	// ASS format: &HAABBGGRR (AA = alpha, 00=solid, FF=transparent)
	const alpha = Math.round((1 - opacity) * 255).toString(16).padStart(2, '0').toUpperCase();
	return `&H${alpha}${b}${g}${r}`.toUpperCase();
}

/**
 * Get ASS alignment number (numpad style)
 */
function getASSAlignment(horizontalAlign: string, verticalAlign: string): number {
	const alignMap: Record<string, Record<string, number>> = {
		top: { left: 7, center: 8, right: 9 },
		middle: { left: 4, center: 5, right: 6 },
		bottom: { left: 1, center: 2, right: 3 },
	};
	return alignMap[verticalAlign]?.[horizontalAlign] ?? 2;
}

/**
 * Parse SRT file and convert to ASS format
 */
function convertSRTtoASS(
	srtContent: string,
	fontName: string,
	fontSize: number,
	primaryColor: string,
	outlineColor: string,
	outlineWidth: number,
	backgroundColor: string,
	backgroundOpacity: number,
	enableBackground: boolean,
	alignment: number,
	marginV: number,
): string {
	// ASS Header
	const borderStyle = enableBackground ? 4 : 1; // 4=box, 1=outline+shadow
	const backColor = colorToASS(backgroundColor, backgroundOpacity);
	
	const assHeader = `[Script Info]
Title: Converted from SRT
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${primaryColor},${outlineColor},${backColor},0,0,0,0,100,100,0,0,${borderStyle},${outlineWidth},0,${alignment},20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

	// Parse SRT content
	const srtBlocks = srtContent.trim().split(/\n\s*\n/);
	const dialogueLines: string[] = [];

	for (const block of srtBlocks) {
		const lines = block.trim().split('\n');
		if (lines.length < 3) continue;

		// Parse timestamp line (format: 00:00:00,000 --> 00:00:00,000)
		const timestampLine = lines[1];
		const timestampMatch = timestampLine.match(
			/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
		);
		if (!timestampMatch) continue;

		const startTime = `${timestampMatch[1]}:${timestampMatch[2]}:${timestampMatch[3]}.${timestampMatch[4].substring(0, 2)}`;
		const endTime = `${timestampMatch[5]}:${timestampMatch[6]}:${timestampMatch[7]}.${timestampMatch[8].substring(0, 2)}`;

		// Get text (lines 3+)
		const text = lines.slice(2).join('\\N').replace(/\r/g, '');

		dialogueLines.push(`Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}`);
	}

	return assHeader + dialogueLines.join('\n');
}

/**
 * Check if file is ASS/SSA format
 */
function isASSFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();
	return ext === '.ass' || ext === '.ssa';
}

export async function executeAddSubtitle(
	this: IExecuteFunctions,
	video: string,
	subtitleFile: string,
	style: IDataObject,
	itemIndex: number,
): Promise<string> {
	const outputPath = getTempFile(path.extname(video));

	// 1. Get Font
	const allFonts = getAvailableFonts();
	const fontKey = (style.fontKey as string) || 'noto-sans-kr';
	const font = allFonts[fontKey] as IDataObject | undefined;

	if (!font || !font.path) {
		throw new NodeOperationError(
			this.getNode(),
			`Selected font key '${fontKey}' is not valid or its file path is missing.`,
			{ itemIndex },
		);
	}

	const fontName = (font.name as string) || 'Sans';
	const fontSize = (style.size as number) || 48;
	const fontColor = (style.color as string) || 'white';
	const outlineWidth = (style.outlineWidth as number) ?? 1;
	const outlineColor = (style.outlineColor as string) || 'black';
	const enableBackground = (style.enableBackground as boolean) ?? false;
	const backgroundColor = (style.backgroundColor as string) || 'black';
	const backgroundOpacity = (style.backgroundOpacity as number) ?? 0.5;

	// 2. Get alignment
	const positionType = style.positionType || 'alignment';
	let horizontalAlign = 'center';
	let verticalAlign = 'bottom';
	let marginV = 20;

	if (positionType === 'alignment') {
		horizontalAlign = (style.horizontalAlign as string) || 'center';
		verticalAlign = (style.verticalAlign as string) || 'bottom';
		marginV = (style.paddingY as number) ?? 20;
	}

	const alignment = getASSAlignment(horizontalAlign, verticalAlign);

	// 3. Prepare subtitle file
	let finalSubtitlePath = subtitleFile;
	let tempAssFile: string | null = null;

	if (isASSFile(subtitleFile)) {
		// ASS file: use directly (ignore style options)
		finalSubtitlePath = subtitleFile;
	} else {
		// SRT file: convert to ASS with styles
		const srtContent = await fs.readFile(subtitleFile, 'utf-8');
		const assContent = convertSRTtoASS(
			srtContent,
			fontName,
			fontSize,
			colorToASS(fontColor, 1),
			colorToASS(outlineColor, 1),
			outlineWidth,
			backgroundColor,
			backgroundOpacity,
			enableBackground,
			alignment,
			marginV,
		);

		tempAssFile = getTempFile('.ass');
		await fs.writeFile(tempAssFile, assContent, 'utf-8');
		finalSubtitlePath = tempAssFile;
	}

	// 4. Build FFmpeg command
	const escapedPath = escapeSubtitlePath(finalSubtitlePath);
	const subtitlesFilter = `subtitles='${escapedPath}'`;

	const command = ffmpeg(video)
		.videoFilters([subtitlesFilter])
		.audioCodec('copy')
		.save(outputPath);

	try {
		await runFfmpeg(command);
		return outputPath;
	} catch (error) {
		await fs.remove(outputPath).catch(() => {});
		throw new NodeOperationError(
			this.getNode(),
			`Error adding subtitles to video. FFmpeg error: ${(error as Error).message}`,
			{ itemIndex },
		);
	} finally {
		// Clean up temp ASS file
		if (tempAssFile) {
			await fs.remove(tempAssFile).catch(() => {});
		}
	}
}
