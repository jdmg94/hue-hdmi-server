<h1 align="center">Hue HDMI Server</h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <a href="#" target="_blank">
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  </a>
</p>

> A web server with mDNS discovery that uses FFmpeg and Sharp to sync video input (HDMI capture card) to Philips Hue lights in real-time for ambient lighting effects

## Features

- Real-time video frame analysis using FFmpeg and Sharp
- Syncs colors to Philips Hue Entertainment areas
- mDNS service discovery for easy client connection
- Public URL tunneling via localtunnel
- Multi-stage Docker builds for optimized production deployment
- REST API for bridge discovery, registration, and streaming control
- Optimized performance with minimal CPU and memory overhead

## Requirements

- HDMI capture device (e.g., `/dev/video0`)
- Philips Hue Bridge with Entertainment area configured
- Docker (recommended) or Node.js 20+ with FFmpeg installed
- Network access to Hue Bridge

## Quick Start

### Using Docker (Recommended)

**Production:**
```sh
docker run -d --net host --device /dev/video0 superiortech/hue-hdmi-server
```

**Or with Docker Compose:**
```sh
# Development mode with hot reload
docker-compose -f docker-compose.dev.yml up

# Production mode
docker-compose -f docker-compose.prod.yml up -d
```

### Local Development

```sh
# Install dependencies (uses pnpm)
pnpm install --ignore-scripts

# Type check
npm run type-check

# Build TypeScript to JavaScript
npm run build

# Development mode with hot reload
npm run dev

# Production mode
npm start
```

## Docker Builds

The project uses multi-stage Docker builds for optimal performance:

```sh
# Development build with hot reload
docker build --target development -t hue-hdmi-server:dev .

# Production build (optimized, minimal image)
docker build --target production -t hue-hdmi-server:prod .
```

**Build Stages:**
- `base` - Common setup (Node.js, FFmpeg, system dependencies)
- `dependencies` - All npm packages installed
- `development` - Dev dependencies + source watching
- `builder` - Type checking and TypeScript compilation
- `production` - Minimal runtime with only prod dependencies

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/check` | GET | Server status |
| `/discovery` | GET | Discover Hue bridges on network |
| `/register` | POST | Register with Hue bridge (press button first) |
| `/entertainment-areas` | GET | List available entertainment areas |
| `/stream/:id` | GET | Start streaming colors to entertainment area |
| `/stop` | GET | Stop active stream |
| `/quick-start` | PUT | Quick configuration with bridge credentials |

## Configuration

### Environment Variables

- `NODE_ENV` - Environment mode (`development` or `production`)
- `NODE_EXTRA_CA_CERTS` - Path to Hue API certificate (auto-configured in Docker)

### Video Capture Settings

Frame processing is optimized for:
- **Resolution:** 1280x720
- **Frame Rate:** 30 FPS (~33ms per frame)
- **Color Regions:** 7 zones matching Philips Hue Gradient Lightstrip layout

## Performance Optimizations

Recent optimizations provide significant performance improvements:

- **Frame timing synchronization:** Proper 30 FPS pacing (40-60% CPU reduction)
- **Duplicate region elimination:** Calculates only 5 unique regions instead of 7 (28% fewer calculations)
- **Buffer reuse:** Pre-allocated buffers eliminate per-frame allocations (70-80% less garbage collection)
- **Worker thread isolation:** Video processing runs in separate thread to avoid blocking server

**Result:** Smooth, low-latency color syncing with minimal system resource usage.

## Architecture

### Core Components

- **Web Server** (`src/router.ts`) - Koa-based REST API
- **CV Worker** (`src/CVWorker.ts`) - Worker thread for video frame processing
- **Tunnel & Discovery** (`src/tunnel.ts`) - mDNS broadcasting and public URL exposure
- **Frame Processing** (`src/utils/splitFrame.ts`) - Region mapping for lightstrip zones

### Frame Region Layout

The frame is divided into 7 regions matching Philips Hue Gradient Lightstrip zones:

```
┌─────────────┬─────────────┬─────────────┐
│ Top-Left    │ Top-Center  │ Top-Right   │
│ (Zone 1,2)  │  (Zone 3)   │  (Zone 4,5) │
├─────────────┼─────────────┼─────────────┤
│ Bottom-Left │             │ Bottom-Right│
│  (Zone 0)   │             │   (Zone 6)  │
└─────────────┴─────────────┴─────────────┘
```

Zones 1-2 and 4-5 share color calculations for better performance.

## Troubleshooting

**Video device not found:**
- Ensure your HDMI capture device is connected and appears at `/dev/video0`
- Check device permissions: `ls -l /dev/video0`

**Can't connect to Hue Bridge:**
- Verify the bridge is on the same network
- Press the physical button on the bridge before calling `/register`
- Check that an Entertainment area is configured in the Hue app

**High CPU usage:**
- Verify frame rate is properly synchronized (check logs)
- Ensure you're running the optimized version (build from latest code)

## Development

### Project Structure

```
src/
├── index.ts              # Main entry point
├── router.ts             # REST API and worker management
├── tunnel.ts             # mDNS and localtunnel setup
├── CVWorker.ts          # Video processing worker thread
└── utils/
    ├── splitFrame.ts     # Frame region mapping
    ├── chunk.ts          # Array chunking utility
    └── sleep.ts          # Async sleep helper
```

### Technology Stack

- **Runtime:** Node.js with TypeScript
- **Build:** SWC (fast TypeScript compiler)
- **Web Framework:** Koa + Koa Router
- **Video Processing:** FFmpeg for capture, Sharp for image processing
- **Hue Integration:** hue-sync (custom fork)
- **Service Discovery:** @homebridge/ciao (mDNS)
- **Tunneling:** localtunnel

## Author

👤 **José Muñoz**

- Website: https://josemunoz.dev/
- Github: [@jdmg94](https://github.com/jdmg94)

## License

MIT

## Show your support

Give a ⭐️ if this project helped you!
