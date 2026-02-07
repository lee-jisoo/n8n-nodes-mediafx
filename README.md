# @lee-jisoo/n8n-nodes-mediafx

[![NPM Version](https://img.shields.io/npm/v/@lee-jisoo/n8n-nodes-mediafx?style=flat-square)](https://www.npmjs.com/package/@lee-jisoo/n8n-nodes-mediafx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![N8N Community Node](https://img.shields.io/badge/n8n-community--node-blue.svg?style=flat-square)](https://n8n.io)

> **Enhanced fork of [n8n-nodes-mediafx](https://github.com/dandacompany/n8n-nodes-mediafx)** with additional features and bug fixes.

This is a custom n8n node for comprehensive, local media processing using FFmpeg. It allows you to perform a wide range of video, audio, image, and text operations directly within your n8n workflows without needing any external API or service.

<a href="https://www.buymeacoffee.com/leejisoo" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50" width="217"></a>

## 🆕 What's New in This Fork

### v1.6.33
**Bug Fixes**

- **🔊 Mix Audio (Audio-Speed mode)**: Fixed audio being cut off ~1 second before the end
  - Added `tpad` to prevent video stream from ending before audio
  - Changed `amix` duration strategy to `longest` to preserve full audio length
  - Added explicit output duration to guarantee exact audio-matched length

### v1.6.30
**Improvements**

- **🧹 Temp File Cleanup**: Now runs on every execution instead of 10% probability
  - More reliable cleanup of orphaned temporary files
  - Files older than 24 hours are automatically removed
  - Reduces disk space usage from crashed/interrupted workflows

### v1.6.29
**New Features**

- **📐 Extended Auto Font Size**: Added larger size options
  - `Auto - Extra Large`: 110% of calculated size
  - `Auto - Huge`: 120% of calculated size
  - `Auto - Maximum`: 130% of calculated size

- **🎨 Per-Line Color Support**: Different colors for each line in multi-line text
  - Enable Line Colors toggle
  - Line 1 Color and Line 2 Color options
  - Lines 3+ automatically use Line 1 color

- **🎬 Match Audio Length (Mix Audio)**: Two new output length options
  - `Match Audio (Loop/Trim Video)`: Loop video if shorter, trim if longer than audio
  - `Match Audio (Adjust Speed)`: Adjust video playback speed to exactly match audio duration

### v1.6.28
**New Features**

- **📝 Multi-line Center Alignment**: Each line is individually centered
  - Works with older FFmpeg versions (no text_align dependency)
  - Each line rendered as separate drawtext filter
  - Line spacing option supported

### v1.6.27
**Improvements**

- **🔧 FFmpeg Bundling Fix**: Now uses `ffmpeg-static` (FFmpeg 5.x) as primary source
  - More reliable cross-platform support
  - Fixes issues with old system FFmpeg being used instead of bundled version

### v1.6.26
**New Features**

- **📐 Auto Font Size**: Automatically calculate font size based on image dimensions
  - `Auto - Small`: Fits text at 50% of calculated size
  - `Auto - Medium`: Fits text at 75% of calculated size
  - `Auto - Large`: Fits text at 100% (fills available width)
  - Supports Korean/CJK characters with proper width weighting

- **😀 Emoji Auto-Removal**: Automatically removes emojis from text
  - Prevents broken/garbled characters in rendered output
  - Emojis are stripped before rendering

- **↕️ Line Spacing**: Adjustable spacing between lines
  - Default 10px, configurable for multi-line text

- **📝 Multi-line Text Alignment**: Text alignment for multi-line text
  - Left, Center, Right alignment options

### v1.6.24
**Bug Fixes**

- **🐛 Add Text to Image Fix**: Fixed "Unable to find a suitable output format" error
  - Issue occurred when input image was downloaded from URL without file extension
  - Now automatically detects actual image format using ffprobe
  - Properly outputs correct format (JPEG, PNG, etc.) regardless of input file extension

### v1.6.21
**New Features**

- **🖼️ Add Text to Image**: Overlay text onto static images
  - Font selection (bundled, user-uploaded, system fonts)
  - Text styling: size, color
  - **Outline**: configurable width and color for text border
  - **Background Box**: optional background with color, opacity, and padding
  - Positioning: alignment-based (9-point grid) or custom X/Y coordinates
  - Output format matches input image format (PNG, JPG, etc.)

### v1.6.20
**New Features**

- **🔍 Get Metadata (Probe)**: Extract comprehensive metadata from video/audio files
  - Format info: filename, format, duration, size, bitrate
  - Video stream: codec, resolution, frame rate, aspect ratio, pixel format
  - Audio stream: codec, sample rate, channels, channel layout
  - Tags: title, artist, album, and other embedded metadata

- **🔤 System Font Support**: Use fonts installed on your system
  - System fonts automatically appear in Font dropdown (Text/Subtitle operations)
  - Supports macOS, Linux, and Windows system font directories
  - Use Font > List with "Include System Fonts" to browse all available fonts

### v1.6.14
**Subtitle Enhancements (v1.6.1 ~ v1.6.14)**

- **🎨 Background Box Padding**: Fixed text sticking to background box edges
  - Added horizontal padding (`\h` hard spaces) when background is enabled
  - Padding automatically scales with font size

- **🎯 Full ASS Format Support**: Complete subtitle styling overhaul
  - SRT to ASS auto-conversion for advanced styling
  - Dynamic video resolution detection (supports vertical videos like 1080x1920)
  - Proper `BorderStyle=3` implementation for opaque background boxes
  - Fixed background color transparency with correct `Outline=0, Shadow=1` settings

- **📍 Flexible Positioning**: 
  - 9-point alignment grid (top/middle/bottom × left/center/right)
  - Customizable padding (X/Y margins)
  - Outline width and color options

### v1.6.0
- **🎬 Speed Operation**: Adjust video playback speed (slow motion or fast forward)
  - Speed range: 0.25x to 4x
  - Option to adjust audio speed along with video
  - Option to maintain original audio pitch
  - Output format selection (MP4, MOV, AVI, MKV)

- **🐛 Subtitle Bug Fix**: Fixed subtitle display issue with slideshow/image-sequence videos
  - Changed from `drawtext` filter chain to `subtitles` filter
  - The original `drawtext` filter's `enable='between(t,X,Y)'` was unreliable with image-sequence videos
  - Now uses FFmpeg's native SRT parsing for correct timing

## Why use this fork?

- **Speed Control**: Easily create slow-motion or fast-forward videos
- **Reliable Subtitles**: Fixed critical bug where subtitles were dropped on slideshow videos
- All original features from [n8n-nodes-mediafx](https://github.com/dandacompany/n8n-nodes-mediafx) included

## Installation

### Via n8n Community Nodes (Recommended)
1. Go to **Settings > Community Nodes**
2. Click **Install**
3. Enter `@lee-jisoo/n8n-nodes-mediafx`
4. Click **Install**

### Manual Installation
```bash
cd ~/.n8n/nodes
npm install @lee-jisoo/n8n-nodes-mediafx
# Restart n8n
```

### Docker Installation
```dockerfile
# In your Dockerfile
RUN cd /home/node/.n8n/nodes && npm install @lee-jisoo/n8n-nodes-mediafx
```

## ⚠️ Troubleshooting

### Node not working after upgrade
If the node doesn't work properly after upgrading to a new version, try **uninstalling and reinstalling** the plugin:

**Via n8n Community Nodes:**
1. Go to **Settings > Community Nodes**
2. Find `@lee-jisoo/n8n-nodes-mediafx` and click **Uninstall**
3. Restart n8n
4. Go to **Settings > Community Nodes** again
5. Click **Install** and enter `@lee-jisoo/n8n-nodes-mediafx`
6. Restart n8n

**Manual Installation:**
```bash
cd ~/.n8n/nodes
npm uninstall @lee-jisoo/n8n-nodes-mediafx
npm install @lee-jisoo/n8n-nodes-mediafx
# Restart n8n
```

## Features

### Video Operations
| Operation | Description |
|-----------|-------------|
| **Merge** | Combine multiple videos into one |
| **Trim** | Cut video to specific start/end time |
| **Speed** | Adjust playback speed (0.25x - 4x) ⭐ NEW |
| **Transition** | Apply transition effects between videos |
| **Fade** | Apply fade in/out effects |
| **Separate Audio** | Split into muted video + audio track |
| **Overlay Video** | Overlay video on top of another |

### Audio Operations
| Operation | Description |
|-----------|-------------|
| **Extract** | Extract audio from video (MP3, WAV, AAC, FLAC) |
| **Mix** | Mix audio tracks with volume control, partial mixing, looping, fade effects, **match audio length** ⭐ NEW |

### Image Operations
| Operation | Description |
|-----------|-------------|
| **Add Text** | Overlay text on image with styling, outline, background box ⭐ NEW |
| **Image to Video** | Create video from image with custom duration |
| **Stamp Image** | Add watermark with position, size, rotation, opacity, time control |

### Text/Subtitle Operations
| Operation | Description |
|-----------|-------------|
| **Add String** | Burn text overlay with styling |
| **Add Subtitle** | Add subtitles from SRT file ⭐ FIXED |

### Probe Operations
| Operation | Description |
|-----------|-------------|
| **Get Metadata** | Extract metadata from video/audio files (format, streams, tags) |

### Font Operations
| Operation | Description |
|-----------|-------------|
| **List** | Get available fonts |
| **Upload** | Upload custom fonts (TTF, OTF) |
| **Delete** | Remove uploaded fonts |

## Usage Examples

### Add Text to Image (New!)
Overlay text on an image with styling:
```json
{
  "resource": "image",
  "operation": "addTextToImage",
  "sourceImageText": {
    "source": { "sourceType": "binary", "binaryProperty": "data" }
  },
  "imageText": "Hello, World!",
  "imageTextFontKey": "noto-sans-kr",
  "imageTextSize": 48,
  "imageTextColor": "white",
  "imageTextOutlineWidth": 2,
  "imageTextOutlineColor": "black",
  "imageTextPositionType": "alignment",
  "imageTextHorizontalAlign": "center",
  "imageTextVerticalAlign": "bottom",
  "imageTextPaddingY": 50
}
```

With background box:
```json
{
  "resource": "image",
  "operation": "addTextToImage",
  "imageText": "Caption Text",
  "imageTextEnableBackground": true,
  "imageTextBackgroundColor": "black",
  "imageTextBackgroundOpacity": 0.7,
  "imageTextBoxPadding": 10
}
```

### Get Media Metadata
Extract metadata from video or audio files:
```json
{
  "resource": "probe",
  "operation": "getMetadata",
  "probeSource": {
    "source": { "sourceType": "binary", "binaryProperty": "data" }
  }
}
```

Example output:
```json
{
  "success": true,
  "operation": "getMetadata",
  "format": {
    "filename": "video.mp4",
    "formatName": "mov,mp4,m4a,3gp,3g2,mj2",
    "duration": 120.5,
    "size": 15728640,
    "bitRate": 1048576
  },
  "video": {
    "codec": "h264",
    "width": 1920,
    "height": 1080,
    "frameRate": 30,
    "aspectRatio": "16:9"
  },
  "audio": {
    "codec": "aac",
    "sampleRate": 48000,
    "channels": 2,
    "channelLayout": "stereo"
  },
  "hasVideo": true,
  "hasAudio": true
}
```

### Using System Fonts (New!)

System fonts are automatically available in the Font dropdown. Just select any font with `(system)` suffix:
```json
{
  "resource": "subtitle",
  "operation": "addSubtitle",
  "fontKey": "system-helvetica",
  "size": 48,
  "color": "white"
}
```

To browse all system fonts, use Font > List:
```json
{
  "resource": "font",
  "operation": "list",
  "filterOptions": {
    "includeSystemFonts": true,
    "fontType": "system"
  }
}
```

### Speed Adjustment
Create a 2x speed video:
```json
{
  "resource": "video",
  "operation": "speed",
  "speedSource": {
    "source": { "sourceType": "binary", "binaryProperty": "data" }
  },
  "speed": 2,
  "adjustAudio": true,
  "maintainPitch": false,
  "speedOutputFormat": "mp4"
}
```

Create slow-motion (0.5x):
```json
{
  "resource": "video",
  "operation": "speed",
  "speed": 0.5,
  "adjustAudio": true
}
```

### Add Subtitles (Fixed!)
Works correctly with slideshow/image-sequence videos:
```json
{
  "resource": "subtitle",
  "operation": "addSubtitle",
  "source": {
    "source": { "sourceType": "binary", "binaryProperty": "video" }
  },
  "subtitleFileSource": {
    "source": { "sourceType": "binary", "binaryProperty": "srt" }
  },
  "fontKey": "noto-sans-kr",
  "size": 48,
  "color": "white",
  "horizontalAlign": "center",
  "verticalAlign": "bottom"
}
```

## Requirements

- **n8n**: Version 1.0+
- **Node.js**: Version 16+
- **FFmpeg**: Auto-installed via `@ffmpeg-installer/ffmpeg`

### Manual FFmpeg Installation (if needed)

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install ffmpeg
```

**Alpine (Docker):**
```bash
apk add ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

## Credits

This is an enhanced fork of [n8n-nodes-mediafx](https://github.com/dandacompany/n8n-nodes-mediafx) by [Dante](https://github.com/dandacompany).

**Original Author**: Dante (datapod.k@gmail.com)  
**Fork Maintainer**: Lee-Jisoo (mihisasi@naver.com)

## Repository

- **This Fork**: [https://github.com/lee-jisoo/n8n-nodes-mediafx](https://github.com/lee-jisoo/n8n-nodes-mediafx)
- **Original**: [https://github.com/dandacompany/n8n-nodes-mediafx](https://github.com/dandacompany/n8n-nodes-mediafx)

## License

MIT
