import { IExecuteFunctions, NodeOperationError, IDataObject } from 'n8n-workflow';
import * as path from 'path';
import ffmpeg = require('fluent-ffmpeg');
import { getTempFile, runFfmpeg, getAvailableFonts } from '../utils';
import * as fs from 'fs-extra';

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

	// Use the same extension as input image
	const inputExt = path.extname(imagePath);
	const outputPath = getTempFile(inputExt);

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
