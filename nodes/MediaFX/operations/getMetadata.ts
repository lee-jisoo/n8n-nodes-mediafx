import ffmpeg = require('fluent-ffmpeg');
import { IExecuteFunctions } from 'n8n-workflow';
import { IDataObject } from 'n8n-workflow';

interface StreamInfo {
	index: number;
	type: string;
	codec: string;
	codecLongName?: string;
	profile?: string;
	// Video specific
	width?: number;
	height?: number;
	aspectRatio?: string;
	frameRate?: number;
	bitRate?: number;
	pixelFormat?: string;
	// Audio specific
	sampleRate?: number;
	channels?: number;
	channelLayout?: string;
	bitsPerSample?: number;
	// Common
	duration?: number;
	language?: string;
	title?: string;
}

interface MediaMetadata {
	format: {
		filename: string;
		formatName: string;
		formatLongName?: string;
		duration: number;
		size: number;
		bitRate: number;
		probeScore?: number;
	};
	streams: StreamInfo[];
	video?: StreamInfo;
	audio?: StreamInfo;
	hasVideo: boolean;
	hasAudio: boolean;
	tags?: IDataObject;
}

export async function executeGetMetadata(
	this: IExecuteFunctions,
	inputPath: string,
	_itemIndex: number,
): Promise<MediaMetadata> {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(inputPath, (err, metadata) => {
			if (err) {
				return reject(new Error(`Failed to probe media file: ${err.message}`));
			}

			const streams: StreamInfo[] = [];
			let videoStream: StreamInfo | undefined;
			let audioStream: StreamInfo | undefined;

			for (const stream of metadata.streams) {
				const streamInfo: StreamInfo = {
					index: stream.index,
					type: stream.codec_type || 'unknown',
					codec: stream.codec_name || 'unknown',
					codecLongName: stream.codec_long_name,
					profile: stream.profile !== undefined ? String(stream.profile) : undefined,
				};

				if (stream.codec_type === 'video') {
					streamInfo.width = stream.width;
					streamInfo.height = stream.height;
					streamInfo.aspectRatio = stream.display_aspect_ratio;
					streamInfo.pixelFormat = stream.pix_fmt;

					// Calculate frame rate from r_frame_rate (e.g., "30000/1001" or "30/1")
					if (stream.r_frame_rate) {
						const parts = stream.r_frame_rate.split('/');
						if (parts.length === 2) {
							const num = parseFloat(parts[0]);
							const den = parseFloat(parts[1]);
							if (den !== 0) {
								streamInfo.frameRate = Math.round((num / den) * 100) / 100;
							}
						}
					}

					if (stream.bit_rate) {
						streamInfo.bitRate = parseInt(stream.bit_rate as string, 10);
					}

					if (stream.duration) {
						streamInfo.duration = parseFloat(stream.duration as string);
					}

					// Extract tags
					if (stream.tags) {
						streamInfo.language = stream.tags.language;
						streamInfo.title = stream.tags.title;
					}

					if (!videoStream) {
						videoStream = streamInfo;
					}
				} else if (stream.codec_type === 'audio') {
					streamInfo.sampleRate = stream.sample_rate ? parseInt(String(stream.sample_rate), 10) : undefined;
					streamInfo.channels = stream.channels;
					streamInfo.channelLayout = stream.channel_layout;
					streamInfo.bitsPerSample = stream.bits_per_sample;

					if (stream.bit_rate) {
						streamInfo.bitRate = parseInt(stream.bit_rate as string, 10);
					}

					if (stream.duration) {
						streamInfo.duration = parseFloat(stream.duration as string);
					}

					// Extract tags
					if (stream.tags) {
						streamInfo.language = stream.tags.language;
						streamInfo.title = stream.tags.title;
					}

					if (!audioStream) {
						audioStream = streamInfo;
					}
				}

				streams.push(streamInfo);
			}

			const format = metadata.format;
			const result: MediaMetadata = {
				format: {
					filename: format.filename || inputPath,
					formatName: format.format_name || 'unknown',
					formatLongName: format.format_long_name,
					duration: format.duration || 0,
					size: format.size || 0,
					bitRate: format.bit_rate ? parseInt(String(format.bit_rate), 10) : 0,
					probeScore: format.probe_score,
				},
				streams,
				hasVideo: !!videoStream,
				hasAudio: !!audioStream,
			};

			if (videoStream) {
				result.video = videoStream;
			}

			if (audioStream) {
				result.audio = audioStream;
			}

			// Extract format tags (metadata like title, artist, album, etc.)
			if (format.tags) {
				result.tags = format.tags as IDataObject;
			}

			resolve(result);
		});
	});
}
