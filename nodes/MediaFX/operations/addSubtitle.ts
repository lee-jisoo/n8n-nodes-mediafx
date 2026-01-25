import { IExecuteFunctions, NodeOperationError, IDataObject } from 'n8n-workflow';
import * as path from 'path';
import * as fs from 'fs-extra';
import ffmpeg = require('fluent-ffmpeg');
import { getTempFile, runFfmpeg, getAvailableFonts, getVideoStreamInfo } from '../utils';

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
		const hex = namedColors[(color || 'white').toLowerCase()] || 'FFFFFF';
		r = hex.substring(0, 2);
		g = hex.substring(2, 4);
		b = hex.substring(4, 6);
	}
	
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
 * Check if file is ASS/SSA format
 */
function isASSFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();
	return ext === '.ass' || ext === '.ssa';
}

/**
 * Build force_style string for subtitles filter
 */
function buildForceStyle(
	fontName: string,
	fontSize: number,
	primaryColor: string,
	outlineColor: string,
	outlineWidth: number,
	backColor: string,
	enableBackground: boolean,
	alignment: number,
	marginV: number,
): string {
	const borderStyle = enableBackground ? 4 : 1;
	
	const styleParams = [
		`FontName=${fontName}`,
		`FontSize=${fontSize}`,
		`PrimaryColour=${primaryColor}`,
		`OutlineColour=${outlineColor}`,
		`BackColour=${backColor}`,
		`Bold=0`,
		`Italic=0`,
		`BorderStyle=${borderStyle}`,
		`Outline=${outlineWidth}`,
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
	let paddingY = 20;

	if (positionType === 'alignment') {
		horizontalAlign = (style.horizontalAlign as string) || 'center';
		verticalAlign = (style.verticalAlign as string) || 'bottom';
		paddingY = (style.paddingY as number) ?? 20;
	}

	const alignment = getASSAlignment(horizontalAlign, verticalAlign);
	
	// Get video height for accurate MarginV calculation
	let videoHeight = 1080; // default fallback
	try {
		const videoInfo = await getVideoStreamInfo(video);
		if (videoInfo && videoInfo.height) {
			videoHeight = videoInfo.height;
		}
	} catch (e) {
		// Use default if ffprobe fails
		console.warn('Could not get video height, using default 1080');
	}
	
	// Calculate MarginV based on vertical alignment and video height
	// ASS MarginV is the distance from the alignment edge
	// For middle alignment, we calculate the margin to center the subtitle
	let marginV = paddingY;
	if (verticalAlign === 'middle') {
		// For middle alignment (4,5,6), MarginV pushes from bottom
		// To center: marginV = (videoHeight / 2) - fontSize - some_offset
		// Simplified: use ~37% of video height as margin from bottom
		marginV = Math.round(videoHeight * 0.37);
	} else if (verticalAlign === 'top') {
		marginV = paddingY;
	} else {
		// bottom
		marginV = paddingY;
	}

	// 3. Convert colors to ASS format
	const primaryColorASS = colorToASS(fontColor, 1);
	const outlineColorASS = colorToASS(outlineColor, 1);
	const backColorASS = colorToASS(backgroundColor, backgroundOpacity);

	// 4. Build FFmpeg command
	const escapedPath = escapeSubtitlePath(subtitleFile);
	
	let subtitlesFilter: string;
	
	if (isASSFile(subtitleFile)) {
		// ASS/SSA file: use directly without force_style
		subtitlesFilter = `subtitles='${escapedPath}'`;
	} else {
		// SRT file: apply force_style
		const forceStyle = buildForceStyle(
			fontName,
			fontSize,
			primaryColorASS,
			outlineColorASS,
			outlineWidth,
			backColorASS,
			enableBackground,
			alignment,
			marginV,
		);
		subtitlesFilter = `subtitles='${escapedPath}':force_style='${forceStyle}'`;
	}

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
	}
}
