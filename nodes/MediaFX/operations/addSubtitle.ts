import { IExecuteFunctions, NodeOperationError, IDataObject } from 'n8n-workflow';
import * as path from 'path';
import * as fs from 'fs-extra';
import ffmpeg = require('fluent-ffmpeg');
import { getTempFile, runFfmpeg, getAvailableFonts } from '../utils';

/**
 * Escape special characters in file path for FFmpeg subtitles filter.
 * FFmpeg subtitles filter requires escaping: \ : [ ] ' 
 */
function escapeSubtitlePath(filePath: string): string {
	return filePath
		.replace(/\\/g, '\\\\\\\\')  // Backslash (Windows paths)
		.replace(/:/g, '\\:')         // Colon
		.replace(/\[/g, '\\[')        // Square brackets
		.replace(/\]/g, '\\]')
		.replace(/'/g, "\\'");        // Single quote
}

/**
 * Build ASS/SSA style string for subtitles filter force_style option.
 * This converts our style options to FFmpeg's force_style format.
 */
function buildForceStyle(
	fontName: string,
	fontSize: number,
	fontColor: string,
	horizontalAlign: string,
	verticalAlign: string,
	marginV: number,
): string {
	// Convert color from CSS format to ASS format (AABBGGRR)
	// Default white = &H00FFFFFF
	let assColor = '&H00FFFFFF';
	if (fontColor && fontColor.startsWith('#') && fontColor.length === 7) {
		// Convert #RRGGBB to &H00BBGGRR (ASS uses BGR order with alpha prefix)
		const r = fontColor.substring(1, 3);
		const g = fontColor.substring(3, 5);
		const b = fontColor.substring(5, 7);
		assColor = `&H00${b}${g}${r}`.toUpperCase();
	} else if (fontColor === 'white') {
		assColor = '&H00FFFFFF';
	} else if (fontColor === 'black') {
		assColor = '&H00000000';
	} else if (fontColor === 'yellow') {
		assColor = '&H0000FFFF';
	} else if (fontColor === 'red') {
		assColor = '&H000000FF';
	}

	// Alignment mapping for ASS (numpad style)
	// 1=bottom-left, 2=bottom-center, 3=bottom-right
	// 4=middle-left, 5=middle-center, 6=middle-right
	// 7=top-left, 8=top-center, 9=top-right
	let alignment = 2; // default: bottom-center
	if (verticalAlign === 'top') {
		alignment = horizontalAlign === 'left' ? 7 : horizontalAlign === 'right' ? 9 : 8;
	} else if (verticalAlign === 'middle') {
		alignment = horizontalAlign === 'left' ? 4 : horizontalAlign === 'right' ? 6 : 5;
	} else {
		// bottom (default)
		alignment = horizontalAlign === 'left' ? 1 : horizontalAlign === 'right' ? 3 : 2;
	}

	const styleParams = [
		`FontName=${fontName}`,
		`FontSize=${fontSize}`,
		`PrimaryColour=${assColor}`,
		`OutlineColour=&H00000000`,  // Black outline
		`BackColour=&H80000000`,     // Semi-transparent black background
		`Bold=0`,
		`Italic=0`,
		`BorderStyle=4`,             // Box style (background box)
		`Outline=1`,
		`Shadow=0`,
		`Alignment=${alignment}`,
		`MarginV=${marginV}`,
	];

	return styleParams.join(',');
}

export async function executeAddSubtitle(
	this: IExecuteFunctions,
	video: string,
	subtitleFile: string,
	style: IDataObject,
	itemIndex: number,
): Promise<string> {
	const outputPath = getTempFile(path.extname(video));

	// 1. Get Font from fontKey
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

	// 2. Handle position based on position type
	const positionType = style.positionType || 'alignment';
	let horizontalAlign = 'center';
	let verticalAlign = 'bottom';
	let marginV = 20;

	if (positionType === 'alignment') {
		horizontalAlign = (style.horizontalAlign as string) || 'center';
		verticalAlign = (style.verticalAlign as string) || 'bottom';
		marginV = (style.paddingY as number) ?? (style.padding as number) ?? 20;
	}

	// 3. Build force_style for subtitles filter
	const forceStyle = buildForceStyle(
		fontName,
		fontSize,
		fontColor,
		horizontalAlign,
		verticalAlign,
		marginV,
	);

	// 4. Escape subtitle file path for FFmpeg
	const escapedSubtitlePath = escapeSubtitlePath(subtitleFile);

	// 5. Build subtitles filter (much more reliable than drawtext chain)
	// Using subtitles filter processes the entire SRT file at once
	const subtitlesFilter = `subtitles='${escapedSubtitlePath}':force_style='${forceStyle}'`;

	const command = ffmpeg(video)
		.videoFilters([subtitlesFilter])
		.audioCodec('copy')
		.save(outputPath);

	try {
		await runFfmpeg(command);
		return outputPath;
	} catch (error) {
		// Clean up output file if creation failed
		await fs.remove(outputPath).catch(() => {});
		throw new NodeOperationError(
			this.getNode(),
			`Error adding subtitles to video. FFmpeg error: ${(error as Error).message}`,
			{ itemIndex },
		);
	}
} 