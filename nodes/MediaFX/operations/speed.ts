import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import ffmpeg = require('fluent-ffmpeg');
import { getTempFile, runFfmpeg } from '../utils';
import * as fs from 'fs-extra';

/**
 * Execute speed adjustment on a video.
 * 
 * @param input - Path to the input video file
 * @param speed - Speed multiplier (0.25 = 4x slower, 2.0 = 2x faster, etc.)
 * @param adjustAudio - Whether to adjust audio speed as well (pitch will change)
 * @param maintainPitch - Whether to maintain audio pitch when adjusting speed (requires rubberband filter)
 * @param outputFormat - Output file format
 * @param itemIndex - Index of the current item being processed
 */
export async function executeSpeed(
	this: IExecuteFunctions,
	input: string,
	speed: number,
	adjustAudio: boolean,
	maintainPitch: boolean,
	outputFormat: string,
	itemIndex: number,
): Promise<string> {
	const outputPath = getTempFile(`.${outputFormat}`);

	// Validate speed value
	if (speed <= 0) {
		throw new NodeOperationError(
			this.getNode(),
			'Speed must be greater than 0',
			{ itemIndex },
		);
	}

	// FFmpeg uses PTS (Presentation Time Stamp) for video speed
	// setpts=0.5*PTS means 2x faster (less time per frame)
	// setpts=2*PTS means 2x slower (more time per frame)
	const videoPtsFactor = 1 / speed;
	const videoFilter = `setpts=${videoPtsFactor}*PTS`;

	// For audio, atempo filter accepts values between 0.5 and 2.0
	// For values outside this range, we need to chain multiple atempo filters
	const buildAtempoFilter = (targetSpeed: number): string[] => {
		const filters: string[] = [];
		let remaining = targetSpeed;

		// atempo only accepts 0.5 to 2.0, so we chain multiple filters
		while (remaining > 2.0) {
			filters.push('atempo=2.0');
			remaining /= 2.0;
		}
		while (remaining < 0.5) {
			filters.push('atempo=0.5');
			remaining /= 0.5;
		}
		filters.push(`atempo=${remaining}`);
		return filters;
	};

	try {
		let command = ffmpeg(input);

		// Apply video speed filter
		command = command.videoFilters([videoFilter]);

		if (adjustAudio) {
			if (maintainPitch) {
				// Use rubberband filter to maintain pitch (requires libavfilter compiled with rubberband)
				// Fallback to atempo if rubberband is not available
				try {
					const audioFilter = `rubberband=tempo=${speed}`;
					command = command.audioFilters([audioFilter]);
				} catch {
					// Fallback to atempo (pitch will change slightly)
					const atempoFilters = buildAtempoFilter(speed);
					command = command.audioFilters(atempoFilters);
				}
			} else {
				// Use atempo filter (pitch will change proportionally)
				const atempoFilters = buildAtempoFilter(speed);
				command = command.audioFilters(atempoFilters);
			}
		} else {
			// Remove audio entirely when not adjusting
			command = command.noAudio();
		}

		command = command
			.videoCodec('libx264')
			.audioCodec('aac')
			.output(outputPath);

		await runFfmpeg(command);
		return outputPath;
	} catch (error) {
		// Clean up output file if creation failed
		await fs.remove(outputPath).catch(() => {});
		throw new NodeOperationError(
			this.getNode(),
			`Error adjusting video speed. FFmpeg error: ${(error as Error).message}`,
			{ itemIndex },
		);
	}
}
