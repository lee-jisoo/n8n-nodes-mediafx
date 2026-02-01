import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg = require('fluent-ffmpeg');
import axios from 'axios';
import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { IDataObject } from 'n8n-workflow';
import * as os from 'os';

// Initialize FFmpeg with comprehensive fallback strategy
let ffmpegPath: string | null = null;
let ffmpegInitialized = false;

function tryInitializeFfmpeg(): boolean {
	if (ffmpegInitialized) return true;

	let ffmpegBinaryPath: string | null = null;
	let ffprobeBinaryPath: string | null = null;

	// Strategy 1: Try ffmpeg-static (recommended, includes FFmpeg 5.x+)
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const ffmpegStatic = require('ffmpeg-static');
		if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
			ffmpegBinaryPath = ffmpegStatic;
			console.log(`FFmpeg found via ffmpeg-static: ${ffmpegStatic}`);
		}
	} catch (e) {
		console.warn('ffmpeg-static not available, trying fallback...');
	}

	// Strategy 2: Fallback to @ffmpeg-installer/ffmpeg
	if (!ffmpegBinaryPath) {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
			if (ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
				ffmpegBinaryPath = ffmpegInstaller.path;
				console.log(`FFmpeg found via @ffmpeg-installer: ${ffmpegInstaller.path}`);
			}
		} catch (e) {
			console.warn('@ffmpeg-installer/ffmpeg not available');
		}
	}

	// Get ffprobe from @ffprobe-installer/ffprobe
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
		if (ffprobeInstaller.path && fs.existsSync(ffprobeInstaller.path)) {
			ffprobeBinaryPath = ffprobeInstaller.path;
			console.log(`FFprobe found via @ffprobe-installer: ${ffprobeInstaller.path}`);
		}
	} catch (e) {
		console.warn('@ffprobe-installer/ffprobe not available');
	}

	// Validate and set paths
	if (!ffmpegBinaryPath) {
		console.error('FFmpeg binary not found in any package.');
		throw new NodeOperationError(
			{ name: 'MediaFX', type: 'n8n-nodes-mediafx.mediaFX' } as any,
			'Could not find FFmpeg executable. Please ensure ffmpeg-static or @ffmpeg-installer/ffmpeg is properly installed.',
		);
	}

	if (!ffprobeBinaryPath) {
		console.error('FFprobe binary not found.');
		throw new NodeOperationError(
			{ name: 'MediaFX', type: 'n8n-nodes-mediafx.mediaFX' } as any,
			'Could not find FFprobe executable. Please ensure @ffprobe-installer/ffprobe is properly installed.',
		);
	}

	// Set executable permissions on non-Windows systems
	if (os.platform() !== 'win32') {
		try {
			fs.chmodSync(ffmpegBinaryPath, '755');
			fs.chmodSync(ffprobeBinaryPath, '755');
			console.log('Set executable permissions for ffmpeg and ffprobe.');
		} catch (permissionError) {
			console.warn('Failed to set executable permissions:', permissionError);
		}
	}

	// Configure fluent-ffmpeg
	ffmpeg.setFfmpegPath(ffmpegBinaryPath);
	ffmpeg.setFfprobePath(ffprobeBinaryPath);
	ffmpegPath = ffmpegBinaryPath;
	ffmpegInitialized = true;

	console.log(`FFmpeg initialized: ${ffmpegBinaryPath}`);
	console.log(`FFprobe initialized: ${ffprobeBinaryPath}`);
	return true;
}

// Try to initialize FFmpeg on module load
tryInitializeFfmpeg();

const TEMP_DIR = path.resolve(__dirname, '..', '..', 'temp_mediafx');
fs.ensureDirSync(TEMP_DIR);

// Function to verify FFmpeg is available
export function verifyFfmpegAvailability(): void {
	if (!ffmpegInitialized) {
		const success = tryInitializeFfmpeg();
		if (!success) {
			// The error is now thrown inside tryInitializeFfmpeg, but as a fallback:
			throw new NodeOperationError(
				{ name: 'MediaFX', type: 'n8n-nodes-mediafx.mediaFX' } as any,
				'FFmpeg is not available. The node failed to initialize it from its internal dependencies.'
			);
		}
	}
	// The rest of the verification logic can be simplified or removed
	// as we now only trust our single source of truth.
	console.log(`FFmpeg verification successful: ${ffmpegPath}`);
}

export function getTempFile(extension: string): string {
	return path.join(TEMP_DIR, `${uuidv4()}${extension}`);
}

// Utility function to clean up old temporary files
export async function cleanupOldTempFiles(maxAgeHours: number = 24): Promise<void> {
	try {
		if (!fs.existsSync(TEMP_DIR)) {
			return;
		}

		const files = await fs.readdir(TEMP_DIR);
		const now = Date.now();
		const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds

		for (const file of files) {
			const filePath = path.join(TEMP_DIR, file);
			try {
				const stats = await fs.stat(filePath);
				const age = now - stats.mtime.getTime();
				
				if (age > maxAge) {
					await fs.remove(filePath);
					console.log(`Cleaned up old temp file: ${file}`);
				}
			} catch (error) {
				// Ignore errors for individual files (file might be in use, etc.)
				console.warn(`Could not clean up temp file ${file}:`, (error as Error).message);
			}
		}
	} catch (error) {
		console.warn('Error during temp file cleanup:', (error as Error).message);
	}
}

export async function downloadSource(url: string): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
	const tempPath = getTempFile(path.extname(new URL(url).pathname) || '.tmp');
	const writer = fs.createWriteStream(tempPath);

	const response = await axios({
		url,
		method: 'GET',
		responseType: 'stream',
	});

	response.data.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on('finish', () => resolve({ filePath: tempPath, cleanup: () => fs.remove(tempPath) }));
		writer.on('error', (err: Error) => {
			fs.remove(tempPath).catch(() => {});
			reject(err);
		});
	});
}

export async function createTempFileFromBuffer(
	buffer: Buffer,
	originalFilename?: string,
): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
	const extension = path.extname(originalFilename || '.tmp');
	const tempPath = getTempFile(extension);
	await fs.writeFile(tempPath, buffer);
	return { filePath: tempPath, cleanup: () => fs.remove(tempPath) };
}

export async function resolveInputs(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
	sourcesConfig: Array<{ sourceType: string; value: string; binaryProperty?: string }>,
): Promise<{ paths: string[]; cleanup: () => Promise<void> }> {
	const cleanupFunctions: (() => Promise<void>)[] = [];
	const paths: string[] = [];

	for (const source of sourcesConfig) {
		let inputPath: string;
		switch (source.sourceType) {
			case 'url': {
				const { filePath, cleanup } = await downloadSource(source.value);
				inputPath = filePath;
				cleanupFunctions.push(cleanup);
				break;
			}
			case 'binary': {
				if (!source.binaryProperty) {
					throw new NodeOperationError(
						executeFunctions.getNode(),
						'Binary property name is not defined for binary source.',
					);
				}
				
				const inputData = executeFunctions.getInputData();
				let binaryData = inputData[itemIndex]?.binary;
				let actualItemIndex = itemIndex;
				
				// Check if binary data exists in current item
				if (!binaryData || !binaryData[source.binaryProperty]) {
					// For merged inputs, check the first item (index 0) as well
					// This handles cases where Merge node combines multiple inputs into one item
					if (itemIndex !== 0 && inputData[0]?.binary && inputData[0].binary[source.binaryProperty]) {
						binaryData = inputData[0].binary;
						actualItemIndex = 0;
						console.log(`[MediaFX] Using binary data from item 0 for property "${source.binaryProperty}"`);
					} else {
						// Provide helpful debugging information
						const currentItemProps = binaryData ? Object.keys(binaryData) : [];
						const firstItemProps = inputData[0]?.binary ? Object.keys(inputData[0].binary) : [];
						const allProps = [...new Set([...currentItemProps, ...firstItemProps])];
						
						const errorMessage = `Binary data not found in property "${source.binaryProperty}". ` +
							`Available properties in current item: ${currentItemProps.length > 0 ? currentItemProps.join(', ') : 'none'}. ` +
							(itemIndex !== 0 && firstItemProps.length > 0 ? 
								`Available in first item: ${firstItemProps.join(', ')}. ` : '') +
							`All available: ${allProps.length > 0 ? allProps.join(', ') : 'none'}`;
						
						throw new NodeOperationError(
							executeFunctions.getNode(),
							errorMessage,
							{ 
								itemIndex,
								description: 'Make sure the binary property name matches the output from the previous node. ' +
									'If using a Merge node, check that the binary properties are correctly named (e.g., data1, data2).'
							},
						);
					}
				}

				const originalFilename = binaryData[source.binaryProperty].fileName;
				const buffer = await executeFunctions.helpers.getBinaryDataBuffer(
					actualItemIndex,
					source.binaryProperty,
				);
				const { filePath, cleanup } = await createTempFileFromBuffer(buffer, originalFilename);
				inputPath = filePath;
				cleanupFunctions.push(cleanup);
				break;
			}
			default:
				throw new NodeOperationError(executeFunctions.getNode(), `Unsupported source type: ${source.sourceType}`);
		}
		paths.push(inputPath);
	}

	const cleanup = async () => {
		for (const func of cleanupFunctions) {
			await func();
		}
	};

	return { paths, cleanup };
}

export function getDuration(filePath: string): Promise<number> {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(filePath, (err, metadata) => {
			if (err) {
				return reject(new Error(`Failed to get video duration: ${err.message}`));
			}
			const duration = metadata.format.duration;
			if (typeof duration !== 'number' || !isFinite(duration)) {
				// Fallback for streams with no duration metadata (like image inputs)
				const videoStream = metadata.streams.find(s => s.codec_type === 'video');
				if(videoStream && videoStream.duration && isFinite(Number(videoStream.duration))) {
					return resolve(Number(videoStream.duration));
				}
				// If it's an image or format without duration, default to a sensible value like 0
				// The caller should handle this case.
				return resolve(0);
			}
			resolve(duration);
		});
	});
}

export async function createSilentAudio(duration: number): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
	const outputPath = getTempFile('.aac');
	const cleanup = () => fs.remove(outputPath);

	if (duration <= 0) {
		// Create a very short, almost zero-length silent audio file for inputs like images.
		duration = 0.01;
	}

	const command = ffmpeg()
		.input('anullsrc')
		.inputOptions('-f', 'lavfi')
		.audioCodec('aac')
		.duration(duration)
		.save(outputPath);

	await runFfmpeg(command);

	return { filePath: outputPath, cleanup };
}

export function runFfmpeg(command: ffmpeg.FfmpegCommand): Promise<void> {
	return new Promise((resolve, reject) => {
		command.on('end', () => resolve());
		// @ts-ignore - The type definitions for fluent-ffmpeg seem to have an issue here.
		command.on('error', (err: Error, stdout: string, stderr: string) => {
			const errorMessage = `${err.message} (ffmpeg stderr: ${stderr})`;
			reject(new Error(errorMessage));
		});
		command.run();
	});
}

export function getVideoStreamInfo(filePath: string): Promise<ffmpeg.FfprobeStream | undefined> {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(filePath, (err, metadata) => {
			if (err) {
				return reject(new Error(`Failed to probe file: ${err.message}`));
			}
			const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
			resolve(videoStream);
		});
	});
}

export function fileHasAudio(filePath: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(filePath, (err, metadata) => {
			if (err) {
				return reject(new Error(`Failed to probe file: ${err.message}`));
			}
			const hasAudio = metadata.streams.some((s) => s.codec_type === 'audio');
			resolve(hasAudio);
		});
	});
}

// ====================================================================
// FONT MANAGEMENT HELPERS
// ====================================================================

// Define paths for font management
const BASE_FONTS_DIR = path.resolve(__dirname, '..', '..', 'fonts');
const USER_FONTS_DIR = path.join(BASE_FONTS_DIR, 'user');
const USER_FONTS_JSON = path.join(USER_FONTS_DIR, 'user-fonts.json');

// System font directories by platform
const SYSTEM_FONT_DIRS: Record<string, string[]> = {
	darwin: [
		'/System/Library/Fonts',
		'/Library/Fonts',
		path.join(os.homedir(), 'Library/Fonts'),
	],
	linux: [
		'/usr/share/fonts',
		'/usr/local/share/fonts',
		path.join(os.homedir(), '.fonts'),
		path.join(os.homedir(), '.local/share/fonts'),
	],
	win32: [
		'C:\\Windows\\Fonts',
		path.join(os.homedir(), 'AppData\\Local\\Microsoft\\Windows\\Fonts'),
	],
};

// Cache for system fonts (to avoid repeated filesystem scans)
let systemFontsCache: IDataObject | null = null;
let systemFontsCacheTime: number = 0;
const SYSTEM_FONTS_CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

// System-registered fonts (must exist in BASE_FONTS_DIR)
export const REGISTERED_FONTS: IDataObject = {
	'noto-sans-kr': { name: 'Noto Sans KR', filename: 'NotoSansKR-Regular.ttf', description: 'Google Noto Sans KR', type: 'korean' },
	'nanum-gothic': { name: 'Nanum Gothic', filename: 'NanumGothic-Regular.ttf', description: 'Naver Nanum Gothic', type: 'korean' },
	'pretendard': { name: 'Pretendard', filename: 'Pretendard-Regular.otf', description: 'Pretendard', type: 'korean' },
	'roboto': { name: 'Roboto', filename: 'Roboto-Regular.ttf', description: 'Google Roboto', type: 'global' },
	'inter': { name: 'Inter', filename: 'Inter-Regular.ttf', description: 'Inter UI Font', type: 'global' },
	'dejavu-sans': { name: 'DejaVu Sans', filename: 'DejaVuSans.ttf', description: 'Default fallback font', type: 'fallback' },
};

// Scan a directory for font files
function scanFontDirectory(dir: string, fonts: IDataObject): void {
	if (!fs.existsSync(dir)) return;

	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				// Recursively scan subdirectories
				scanFontDirectory(fullPath, fonts);
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name).toLowerCase();
				if (ext === '.ttf' || ext === '.otf' || ext === '.ttc' || ext === '.otc') {
					// Generate a unique key from the filename
					const baseName = path.basename(entry.name, ext);
					const fontKey = `system-${baseName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

					// Skip if already exists (avoid duplicates)
					if (!fonts[fontKey]) {
						fonts[fontKey] = {
							name: baseName,
							filename: entry.name,
							path: fullPath,
							description: `System font from ${dir}`,
							type: 'system',
						};
					}
				}
			}
		}
	} catch (error) {
		// Ignore permission errors for system directories
		console.warn(`Could not scan font directory ${dir}:`, (error as Error).message);
	}
}

// Get system fonts with caching
export function getSystemFonts(): IDataObject {
	const now = Date.now();

	// Return cached result if still valid
	if (systemFontsCache && (now - systemFontsCacheTime) < SYSTEM_FONTS_CACHE_TTL) {
		return systemFontsCache;
	}

	const fonts: IDataObject = {};
	const platform = os.platform();
	const fontDirs = SYSTEM_FONT_DIRS[platform] || [];

	for (const dir of fontDirs) {
		scanFontDirectory(dir, fonts);
	}

	// Update cache
	systemFontsCache = fonts;
	systemFontsCacheTime = now;

	return fonts;
}

// Helper functions for font management
function ensureUserFontsDirectory() {
	if (!fs.existsSync(USER_FONTS_DIR)) {
		fs.mkdirSync(USER_FONTS_DIR, { recursive: true });
	}
}

export function getUserFonts(): IDataObject {
	ensureUserFontsDirectory();
	if (!fs.existsSync(USER_FONTS_JSON)) {
		return {};
	}
	try {
		const data = fs.readFileSync(USER_FONTS_JSON, 'utf8');
		return JSON.parse(data);
	} catch (error) {
		return {};
	}
}

function saveUserFonts(userFonts: IDataObject) {
	ensureUserFontsDirectory();
	fs.writeFileSync(USER_FONTS_JSON, JSON.stringify(userFonts, null, 2));
}

export function getAvailableFonts(includeSystemFonts: boolean = false): IDataObject {
	const fonts: IDataObject = {};

	// Add registered fonts (bundled with the package)
	for (const [key, font] of Object.entries(REGISTERED_FONTS)) {
		const fontPath = path.join(BASE_FONTS_DIR, (font as IDataObject).filename as string);
		if (fs.existsSync(fontPath)) {
			fonts[key] = { ...(font as IDataObject), path: fontPath, type: (font as IDataObject).type || 'bundled' };
		}
	}

	// Add user fonts
	const userFonts = getUserFonts();
	for (const [key, font] of Object.entries(userFonts)) {
		const fontPath = path.join(USER_FONTS_DIR, (font as IDataObject).filename as string);
		if (fs.existsSync(fontPath)) {
			fonts[key] = { ...(font as IDataObject), path: fontPath, type: 'user' };
		}
	}

	// Add system fonts if requested
	if (includeSystemFonts) {
		const systemFonts = getSystemFonts();
		for (const [key, font] of Object.entries(systemFonts)) {
			// Don't override bundled or user fonts with system fonts
			if (!fonts[key]) {
				fonts[key] = font;
			}
		}
	}

	return fonts;
}

// Get font info by path (for system fonts specified by path)
export function getFontByPath(fontPath: string): IDataObject | null {
	if (!fs.existsSync(fontPath)) {
		return null;
	}

	const ext = path.extname(fontPath).toLowerCase();
	if (ext !== '.ttf' && ext !== '.otf' && ext !== '.ttc' && ext !== '.otc') {
		return null;
	}

	const baseName = path.basename(fontPath, ext);
	return {
		name: baseName,
		filename: path.basename(fontPath),
		path: fontPath,
		description: 'System font',
		type: 'system',
	};
}

export function validateFontKey(fontKey: string) {
	const keyPattern = /^[a-zA-Z0-9_-]{3,50}$/;
	if (!keyPattern.test(fontKey)) {
		throw new Error('Font key must be 3-50 characters, containing only letters, numbers, hyphens, and underscores.');
	}

	const allFonts = getAvailableFonts();
	if (allFonts[fontKey]) {
		throw new Error('Font key already exists. Please use a different key.');
	}
}

export function saveUserFont(fontKey: string, fontName: string, description: string, originalFilename: string, buffer: Buffer) {
	validateFontKey(fontKey);

	const ext = path.extname(originalFilename);
	const filename = `${fontKey}${ext}`;
	const fontPath = path.join(USER_FONTS_DIR, filename);

	fs.writeFileSync(fontPath, buffer);

	const userFonts = getUserFonts();
	userFonts[fontKey] = {
		name: fontName || fontKey,
		filename,
		description,
		createdAt: new Date().toISOString(),
	};
	saveUserFonts(userFonts);

	return { fontKey, path: fontPath, metadata: userFonts[fontKey] };
}

export function deleteUserFont(fontKey: string) {
	const userFonts = getUserFonts();
	const font = userFonts[fontKey] as IDataObject;

	if (!font) {
		throw new Error(`User font with key '${fontKey}' not found.`);
	}

	const fontPath = path.join(USER_FONTS_DIR, font.filename as string);
	if (fs.existsSync(fontPath)) {
		fs.unlinkSync(fontPath);
	}

	delete userFonts[fontKey];
	saveUserFonts(userFonts);

	return true;
} 
// Re-export ffmpeg version utilities
export { getFFmpegCapabilities, checkTransitionSupport } from './utils/ffmpegVersion';
