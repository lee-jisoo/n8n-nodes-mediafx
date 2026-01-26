# @lee-jisoo/n8n-nodes-mediafx

[![NPM Version](https://img.shields.io/npm/v/@lee-jisoo/n8n-nodes-mediafx?style=flat-square)](https://www.npmjs.com/package/@lee-jisoo/n8n-nodes-mediafx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![N8N Community Node](https://img.shields.io/badge/n8n-community--node-blue.svg?style=flat-square)](https://n8n.io)

> **Enhanced fork of [n8n-nodes-mediafx](https://github.com/dandacompany/n8n-nodes-mediafx)** with additional features and bug fixes.

This is a custom n8n node for comprehensive, local media processing using FFmpeg. It allows you to perform a wide range of video, audio, image, and text operations directly within your n8n workflows without needing any external API or service.

## 🆕 What's New in This Fork

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
| **Mix** | Mix audio tracks with volume control, partial mixing, looping, fade effects |

### Image Operations
| Operation | Description |
|-----------|-------------|
| **Image to Video** | Create video from image with custom duration |
| **Stamp Image** | Add watermark with position, size, rotation, opacity, time control |

### Text/Subtitle Operations
| Operation | Description |
|-----------|-------------|
| **Add String** | Burn text overlay with styling |
| **Add Subtitle** | Add subtitles from SRT file ⭐ FIXED |

### Font Operations
| Operation | Description |
|-----------|-------------|
| **List** | Get available fonts |
| **Upload** | Upload custom fonts (TTF, OTF) |
| **Delete** | Remove uploaded fonts |

## Usage Examples

### Speed Adjustment (New!)
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
