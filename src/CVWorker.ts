import { parentPort } from "worker_threads"
import { spawn, ChildProcess } from "child_process"
import { debuglog } from "util"
import sharp from "sharp"

const debug = debuglog("cvworker")

import sleep from "./utils/sleep"
import splitFrame from "./utils/splitFrame"

let shouldRun = true
let ffmpegProcess: ChildProcess | null = null

const WIDTH = 640
const HEIGHT = 480
const FPS = 30

const { regions, indices } = splitFrame({ width: WIDTH, height: HEIGHT })

// Pre-allocate reusable buffer for color data (7 zones × 3 colors = 21 values)
const colorBuffer = new Uint32Array(21)
// Pre-allocate array to store unique region colors
const uniqueColors: [number, number, number][] = new Array(regions.length)

const JPEG_SOI = Buffer.from([0xff, 0xd8, 0xff])
const JPEG_EOI = Buffer.from([0xff, 0xd9])

const stopVideo = () => {
  shouldRun = false
  if (ffmpegProcess) {
    try {
      ffmpegProcess.stdout?.destroy()
      ffmpegProcess.kill("SIGKILL")
    } catch {
      // already dead
    }
    ffmpegProcess = null
  }
}

const processFrame = async (jpegBuffer: Buffer): Promise<void> => {
  try {
    const image = sharp(jpegBuffer)

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i]
      const { channels } = await image
        .clone()
        .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
        .stats()

      const r = Math.round(channels[0].mean)
      const g = Math.round(channels[1].mean)
      const b = Math.round(channels[2].mean)
      uniqueColors[i] = [r, g, b]
      debug(`region ${i} (x:${region.x} y:${region.y} w:${region.width} h:${region.height}) => rgb(${r}, ${g}, ${b})`)
    }

    let bufferIndex = 0
    for (const idx of indices) {
      const [r, g, b] = uniqueColors[idx]
      colorBuffer[bufferIndex++] = r
      colorBuffer[bufferIndex++] = g
      colorBuffer[bufferIndex++] = b
    }

    debug("color buffer: %o", Array.from(colorBuffer))

    const transferBuffer = colorBuffer.slice()
    parentPort!.postMessage(transferBuffer, [transferBuffer.buffer])
  } catch (error) {
    console.error("Error processing frame:", error)
  }
}

const processVideo = async () => {
  shouldRun = true

  ffmpegProcess = spawn("/usr/bin/ffmpeg", [
    "-f", "v4l2",
    "-input_format", "mjpeg",
    "-framerate", FPS.toString(),
    "-video_size", `${WIDTH}x${HEIGHT}`,
    "-i", "/dev/video0",
    "-f", "mjpeg",
    "-q:v", "3",
    "pipe:1",
  ], {
    stdio: ["ignore", "pipe", "pipe"],
  })

  let mjpegBuffer = Buffer.alloc(0)
  let chunkCount = 0
  let frameCount = 0

  ffmpegProcess.stdout?.on("data", (chunk: Buffer) => {
    if (!shouldRun) return

    chunkCount++
    debug("stdout chunk #%d: %d bytes, buffer before: %d bytes", chunkCount, chunk.byteLength, mjpegBuffer.byteLength)

    mjpegBuffer = Buffer.concat([mjpegBuffer, chunk])

    let soiIndex: number
    while ((soiIndex = mjpegBuffer.indexOf(JPEG_SOI)) !== -1) {
      const eoiIndex = mjpegBuffer.indexOf(JPEG_EOI, soiIndex + JPEG_SOI.length)
      if (eoiIndex === -1) {
        debug("SOI found at %d, no EOI yet — waiting for more data (buffer: %d bytes)", soiIndex, mjpegBuffer.byteLength)
        break
      }

      const frameEnd = eoiIndex + JPEG_EOI.length
      const jpegFrame = mjpegBuffer.slice(soiIndex, frameEnd)
      mjpegBuffer = mjpegBuffer.slice(frameEnd)
      frameCount++

      debug("frame #%d: %d bytes (SOI at %d, EOI at %d)", frameCount, jpegFrame.byteLength, soiIndex, eoiIndex)
      processFrame(jpegFrame)
    }

    if (mjpegBuffer.byteLength > 0 && mjpegBuffer.indexOf(JPEG_SOI) === -1) {
      debug("no SOI in %d-byte buffer — discarding stale bytes", mjpegBuffer.byteLength)
      mjpegBuffer = Buffer.alloc(0)
    }
  })

  let stderrBuf = ""
  ffmpegProcess.stderr?.on("data", (data: Buffer) => {
    stderrBuf += data.toString()
    debug("FFmpeg stderr: %s", data.toString().trim())
  })

  ffmpegProcess.on("error", (err) => {
    console.error("FFmpeg spawn error:", err.message)
  })

  ffmpegProcess.on("close", (code) => {
    ffmpegProcess = null
    if (code !== 0 && code !== null && stderrBuf) {
      const lines = stderrBuf.trim().split("\n")
      const tail = lines.slice(-5).join("\n")
      console.error(`FFmpeg exited (code ${code}):\n${tail}`)
    }
  })
}

parentPort?.on("message", (message) => {
  switch (message) {
    case "start":
      processVideo()
      break

    case "stop":
      stopVideo()
      break

    case "reset":
      stopVideo()
      sleep(250).then(() => {
        processVideo()
      })
      break

    default: // do nothing
  }
})
