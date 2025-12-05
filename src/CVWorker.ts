import { parentPort } from "worker_threads"
import {
  Size,
  VideoCapture,
  CAP_ANY,
  CAP_PROP_FPS,
  CAP_PROP_CONVERT_RGB,
  CAP_PROP_FRAME_WIDTH,
  CAP_PROP_FRAME_HEIGHT,
} from "@u4/opencv4nodejs"

import sleep from "./utils/sleep"
import { bgr2rgb } from "./utils/bgr2rgb"
import splitFrame from "./utils/splitFrame"

let shouldRun = true
const size = new Size(1280, 720)
const { regions, indices } = splitFrame(size)

const stopVideo = () => {
  shouldRun = false
}

const processVideo = async () => {
  shouldRun = true
  const capture = new VideoCapture(CAP_ANY)

  await sleep(1000)

  capture.set(CAP_PROP_FPS, 30)
  capture.set(CAP_PROP_CONVERT_RGB, 1)
  capture.set(CAP_PROP_FRAME_WIDTH, size.width)
  capture.set(CAP_PROP_FRAME_HEIGHT, size.height)

  // Pre-allocate reusable buffer for color data (7 zones × 3 colors = 21 values)
  const colorBuffer = new Uint32Array(21)
  // Pre-allocate array to store unique region colors
  const uniqueColors: number[][] = new Array(regions.length)

  const loop = setInterval(() => {
    if (!shouldRun) {
      capture.release()
      clearInterval(loop)
    }

    const frame = capture.read()

    if (!frame.empty) {
      // Calculate mean color for each unique region (no duplicates)
      for (let i = 0; i < regions.length; i++) {
        uniqueColors[i] = bgr2rgb(frame.getRegion(regions[i]).mean())
      }

      // Map unique colors to 7 lightstrip zones using indices
      let bufferIndex = 0
      for (const idx of indices) {
        const [r, g, b] = uniqueColors[idx]
        colorBuffer[bufferIndex++] = r
        colorBuffer[bufferIndex++] = g
        colorBuffer[bufferIndex++] = b
      }

      // Transfer buffer ownership for zero-copy message passing
      const transferBuffer = colorBuffer.slice()
      parentPort!.postMessage(transferBuffer, [transferBuffer.buffer])
    }
  }, 33) // 30 FPS = ~33ms per frame
}

parentPort?.on("message", (message) => {
  switch (message) {
    case "start":
      processVideo();
      break;

    case "stop":
      stopVideo();
      break;
    
    case "reset":
      stopVideo(); sleep(250).then(() => {
        processVideo()
      })
      break;
    
    default: // do nothing
  }
})
