import { IDataObject, IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { getTempFile, runFfmpeg, fileHasAudio, createSilentAudio, getDuration, verifyFfmpegAvailability } from '../utils';
import ffmpeg = require('fluent-ffmpeg');

export async function executeMixAudio(
	this: IExecuteFunctions,
	videoPath: string,
	audioPath: string,
	videoVolume: number,
	audioVolume: number,
	matchLength: 'shortest' | 'longest' | 'first' | 'audio' | 'audio-speed',
	advancedMixing: IDataObject,
	itemIndex: number,
): Promise<string> {
	// Verify FFmpeg is available before proceeding
	try {
		verifyFfmpegAvailability();
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`FFmpeg is not available: ${(error as Error).message}`,
			{ itemIndex }
		);
	}

	const outputPath = getTempFile('.mp4');
	
	const {
		enablePartialMix = false,
		startTime = 0,
		duration,
		loop = false,
		enableFadeIn = false,
		fadeInDuration = 1,
		enableFadeOut = false,
		fadeOutDuration = 1,
	} = advancedMixing as {
		enablePartialMix?: boolean;
		startTime?: number;
		duration?: number;
		loop?: boolean;
		enableFadeIn?: boolean;
		fadeInDuration?: number;
		enableFadeOut?: boolean;
		fadeOutDuration?: number;
	};


	// Check if both inputs have audio
	const videoHasAudio = await fileHasAudio(videoPath);
	const audioFileHasAudio = await fileHasAudio(audioPath);

	// If the "audio" file doesn't have audio, throw an error
	if (!audioFileHasAudio) {
		throw new NodeOperationError(
			this.getNode(),
			'The secondary audio source does not contain any audio stream',
			{ itemIndex },
		);
	}

	// If video doesn't have audio, we'll create a silent audio track for it
	let actualVideoPath = videoPath;
	let videoCleanup: (() => Promise<void>) | null = null;
	
	if (!videoHasAudio) {
		const videoDuration = await getDuration(videoPath);
		const { filePath: silentAudioPath, cleanup } = await createSilentAudio(videoDuration);
		videoCleanup = cleanup;
		
		// Create a temporary video with silent audio
		const tempVideoWithAudio = getTempFile('.mp4');
		const addSilentCommand = ffmpeg()
			.input(videoPath)
			.input(silentAudioPath)
			.outputOptions(['-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-shortest'])
			.save(tempVideoWithAudio);
		
		await runFfmpeg(addSilentCommand);
		await cleanup(); // Clean up the silent audio file
		
		actualVideoPath = tempVideoWithAudio;
		videoCleanup = () => require('fs-extra').remove(tempVideoWithAudio);
	}

	const command = ffmpeg().input(actualVideoPath).input(audioPath);

	if (enablePartialMix) {
		// Get audio duration to determine processing strategy
		const audioDuration = await getDuration(audioPath);
		
		// If duration is not provided (null/undefined), use audio duration
		const actualDuration = duration || audioDuration;
		
		let audioProcessingChain = '[1:a]';
		
		// Step 1: Handle looping if needed
		if (loop && audioDuration < actualDuration) {
			audioProcessingChain += 'aloop=loop=-1:size=2e9,';
		}
		
		// Step 2: Trim to duration
		if (loop && audioDuration < actualDuration || audioDuration >= actualDuration) {
			audioProcessingChain += `atrim=duration=${actualDuration},`;
		}
		
		// Step 3: Reset timestamps
		audioProcessingChain += 'asetpts=PTS-STARTPTS,';
		
		// Step 4: Apply fade effects
		const fadeFilters = [];
		if (enableFadeIn) {
			fadeFilters.push(`afade=t=in:st=0:d=${fadeInDuration}`);
		}
		if (enableFadeOut) {
			const fadeOutStart = Math.max(0, actualDuration - fadeOutDuration);
			fadeFilters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}`);
		}
		
		if (fadeFilters.length > 0) {
			audioProcessingChain += fadeFilters.join(',') + ',';
		}
		
		// Step 5: Set volume and add delay
		audioProcessingChain += `volume=${audioVolume},adelay=${startTime * 1000}|${startTime * 1000}[overlay_audio]`;
		
		const filterComplex = 
			audioProcessingChain + ';' +
			`[0:a]volume=${videoVolume}[main_audio];` +
			`[main_audio][overlay_audio]amix=inputs=2:duration=first:dropout_transition=0[mixed_audio]`;

		command
			.complexFilter(filterComplex)
			.outputOptions(['-map', '0:v', '-map', '[mixed_audio]', '-c:v copy']);
	} else {
		// Standard full audio mix with fade effects
		const videoDuration = await getDuration(actualVideoPath);
		const audioDuration = await getDuration(audioPath);

		// Handle special modes: 'audio' (loop/trim video) and 'audio-speed' (adjust video speed)
		if (matchLength === 'audio' || matchLength === 'audio-speed') {
			const effectiveDuration = audioDuration;

			// Build audio processing chain
			let audioProcessingChain = '[1:a]';
			const fadeFilters = [];
			if (enableFadeIn) {
				fadeFilters.push(`afade=t=in:st=0:d=${fadeInDuration}`);
			}
			if (enableFadeOut) {
				const fadeOutStart = Math.max(0, effectiveDuration - fadeOutDuration);
				fadeFilters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}`);
			}
			if (fadeFilters.length > 0) {
				audioProcessingChain += fadeFilters.join(',') + ',';
			}
			audioProcessingChain += `volume=${audioVolume}[a1]`;

			if (matchLength === 'audio-speed') {
				// Adjust video speed to match audio duration
				const speedRatio = videoDuration / audioDuration;

				// Video: use setpts to adjust speed (PTS/speed = slower, PTS*speed = faster)
				// If speedRatio > 1, video is longer than audio, need to speed up (smaller PTS)
				// If speedRatio < 1, video is shorter than audio, need to slow down (larger PTS)
				const videoFilter = `[0:v]setpts=PTS/${speedRatio}[v_adjusted]`;

				// Original video audio: adjust with atempo
				// atempo only accepts 0.5 to 2.0, so chain multiple if needed
				let atempoChain = '';
				let remainingRatio = speedRatio;
				while (remainingRatio > 2.0) {
					atempoChain += 'atempo=2.0,';
					remainingRatio /= 2.0;
				}
				while (remainingRatio < 0.5) {
					atempoChain += 'atempo=0.5,';
					remainingRatio /= 0.5;
				}
				atempoChain += `atempo=${remainingRatio}`;

				const videoAudioFilter = `[0:a]${atempoChain},volume=${videoVolume},apad,atrim=duration=${audioDuration},asetpts=PTS-STARTPTS[a0]`;

				const filterComplex =
					videoFilter + ';' +
					videoAudioFilter + ';' +
					audioProcessingChain + ';' +
					`[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[a]`;

				command
					.complexFilter(filterComplex)
					.outputOptions(['-map', '[v_adjusted]', '-map', '[a]']);
			} else {
				// 'audio' mode: Loop or trim video to match audio length
				let videoFilter: string;

				if (videoDuration < audioDuration) {
					// Video is shorter: loop video to match audio duration
					const loopCount = Math.ceil(audioDuration / videoDuration);
					videoFilter = `[0:v]loop=loop=${loopCount}:size=32767:start=0,trim=duration=${audioDuration},setpts=PTS-STARTPTS[v_adjusted]`;
				} else {
					// Video is longer: trim video to match audio duration
					videoFilter = `[0:v]trim=duration=${audioDuration},setpts=PTS-STARTPTS[v_adjusted]`;
				}

				// Also adjust video's original audio to match
				let videoAudioFilter: string;
				if (videoDuration < audioDuration) {
					const loopCount = Math.ceil(audioDuration / videoDuration);
					videoAudioFilter = `[0:a]aloop=loop=${loopCount}:size=2e9,atrim=duration=${audioDuration},asetpts=PTS-STARTPTS,volume=${videoVolume}[a0]`;
				} else {
					videoAudioFilter = `[0:a]atrim=duration=${audioDuration},asetpts=PTS-STARTPTS,volume=${videoVolume}[a0]`;
				}

				const filterComplex =
					videoFilter + ';' +
					videoAudioFilter + ';' +
					audioProcessingChain + ';' +
					`[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[a]`;

				command
					.complexFilter(filterComplex)
					.outputOptions(['-map', '[v_adjusted]', '-map', '[a]']);
			}
		} else {
			// Standard modes: shortest, longest, first
			let audioProcessingChain = '[1:a]';

			let effectiveDuration: number;
			switch (matchLength) {
				case 'shortest':
					effectiveDuration = Math.min(videoDuration, audioDuration);
					break;
				case 'longest':
					effectiveDuration = Math.max(videoDuration, audioDuration);
					break;
				case 'first':
				default:
					effectiveDuration = videoDuration;
					break;
			}

			// Apply fade effects if enabled
			const fadeFilters = [];
			if (enableFadeIn) {
				fadeFilters.push(`afade=t=in:st=0:d=${fadeInDuration}`);
			}
			if (enableFadeOut) {
				// Calculate fade out start based on effective duration, not original audio duration
				const fadeOutStart = Math.max(0, effectiveDuration - fadeOutDuration);
				fadeFilters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}`);
			}

			if (fadeFilters.length > 0) {
				audioProcessingChain += fadeFilters.join(',') + ',';
			}

			// Apply volume and create labeled output
			audioProcessingChain += `volume=${audioVolume}[a1]`;

			const filterComplex =
				audioProcessingChain + ';' +
				`[0:a]volume=${videoVolume}[a0];` +
				`[a0][a1]amix=inputs=2:duration=${matchLength}[a]`;

			command
				.complexFilter(filterComplex)
				.outputOptions(['-map', '0:v', '-map', '[a]', '-c:v copy']);
		}
	}

	command.save(outputPath);

	try {
		await runFfmpeg(command);
		
		// Clean up temporary video file if we created one
		if (videoCleanup) {
			await videoCleanup();
		}
		
		return outputPath;
	} catch (error) {
		// Clean up output file if creation failed
		await require('fs-extra').remove(outputPath).catch(() => {});
		
		// Clean up temporary video file if we created one
		if (videoCleanup) {
			await videoCleanup().catch(() => {});
		}
		throw new NodeOperationError(
			this.getNode(),
			`Error mixing audio: ${(error as Error).message}`,
			{ itemIndex },
		);
	}
} 