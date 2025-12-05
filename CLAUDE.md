# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hue HDMI Server is a web server with mDNS discovery that uses OpenCV to sync video input (HDMI capture card) to Philips Hue lights in real-time. The server captures video frames, analyzes color data from different regions, and sends those colors to Hue entertainment areas for ambient lighting effects.

## Build & Development Commands

```bash
# Install dependencies (uses pnpm)
pnpm install --ignore-scripts

# Build TypeScript to JavaScript
npm run build  # or: pnpm build

# Development mode with hot reload
npm run dev  # or: pnpm dev

# Docker build (dev mode)
docker build --build-arg target=dev -t hue-hdmi-server:dev .

# Docker build (production mode)
docker build --build-arg target=prod -t hue-hdmi-server:prod .

# Run production Docker container (requires HDMI capture device)
docker run -d --net host --device /dev/video0 superiortech/hue-hdmi-server
```

## Architecture

### Core Components

**Main Entry Point** (`src/index.ts`)
- Initializes the web server and tunnel
- Implements graceful shutdown handlers for SIGINT/SIGTERM
- Auto-retry mechanism via `tryAgain()` function

**Web Server** (`src/router.ts`)
- Koa-based REST API with the following endpoints:
  - `GET /check` - Server status
  - `GET /discovery` - Discover Hue bridges on network
  - `POST /register` - Register with Hue bridge (press button on bridge first)
  - `GET /entertainment-areas` - List available entertainment areas
  - `GET /stream/:id` - Start streaming colors to entertainment area
  - `GET /stop` - Stop active stream
  - `PUT /quick-start` - Quick configuration with bridge credentials
- Uses an in-memory Map cache for bridge configuration and state
- Spawns a Worker thread (`CVWorker`) for video processing
- Receives color data from worker and forwards to Hue bridge via `hue-sync` library

**CV Worker Thread** (`src/CVWorker.ts`)
- Runs in separate Worker thread to avoid blocking main server
- Uses OpenCV to capture video from device (default `/dev/video0`)
- Processes frames at 1280x720, 30 FPS
- Divides frame into regions matching Philips Hue Lightstrip gradient zones (7 regions)
- Extracts mean BGR color from each region, converts to RGB
- Sends flattened color array back to main thread via `postMessage`
- Responds to "start", "stop", and "reset" commands

**Tunnel & Discovery** (`src/tunnel.ts`)
- Uses `localtunnel` to expose local server publicly (custom tunnel server: `https://lt.josemunoz.dev`)
- Broadcasts service via mDNS (Bonjour/Ciao) as `hue-hdmi-sync` type
- Advertises tunnel URL in mDNS TXT record for client discovery

### Frame Processing

**Region Mapping** (`src/utils/splitFrame.ts`)
- Splits 1280x720 frame into 7 regions matching Philips Hue Gradient Lightstrip zones
- Layout: [bottom-left, top-left, top-left, top-center, top-right, top-right, bottom-right]
- Some regions are intentionally duplicated to match lightstrip segment count

**Color Conversion** (`src/utils/bgr2rgb.ts`)
- Converts OpenCV's default BGR format to RGB for Hue compatibility

### State Management

Server uses enum-based status tracking:
- `NOT_READY` - Initial state, no bridge configured
- `READY` - Bridge configured, ready to stream
- `IDLE` - Bridge configured but not streaming
- `WORKING` - Actively streaming colors to Hue lights
- `ERROR` - Error state

Bridge configuration cached in Map:
- `id`, `url`, `key`, `username` - Bridge credentials
- `bridge` - HueSync instance (lazy loaded)
- `status` - Current server status

## Special Requirements

### OpenCV Setup

- Uses `@u4/opencv4nodejs` with `disableAutoBuild: "1"` in package.json
- Docker image based on `superiortech/opencv4nodejs` which has OpenCV pre-built
- Requires video capture device access (e.g., `/dev/video0`)

### Certificate Configuration

- Philips Hue requires custom CA certificate
- Must set `NODE_EXTRA_CA_CERTS=/usr/src/node_modules/hue-sync/signify.pem` environment variable
- This is handled in `dev.sh` and `prod.sh` scripts

### Network Requirements

- Uses `--net host` in Docker for mDNS discovery to work
- Exposes ports: 443, 8080, 3000 (HTTP), 2100/udp (mDNS)
- Default server port is 3000

## TypeScript Transpilation

- Uses SWC (not tsc) for fast TypeScript compilation
- Source: `src/` directory
- Output: `build/` directory
- Config in `.swcrc`
- Dev mode uses `concurrently` to run SWC in watch mode + nodemon

## Dependencies

Key libraries:
- `hue-sync` (custom fork: `github:jdmg94/hue-sync`) - Philips Hue Entertainment API client
- `@u4/opencv4nodejs` - OpenCV bindings for Node.js
- `@homebridge/ciao` - mDNS/Bonjour service discovery
- `localtunnel` - Public URL tunneling
- `koa` + `@koa/router` - Web framework
