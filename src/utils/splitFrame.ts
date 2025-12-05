import { Size, Rect } from "@u4/opencv4nodejs"

interface FrameRegions {
  regions: Rect[]
  indices: number[]
}

const splitIntoLightstripGradientRegions = (size: Size): FrameRegions => {
  const halfHeight = Math.floor(size.height / 2)
  const oneThirdWidth = Math.floor(size.width / 3)
  const firstQuarter = new Rect(0, halfHeight, oneThirdWidth, halfHeight)
  const secondQuarter = new Rect(0, 0, oneThirdWidth, halfHeight)
  const oneThird = new Rect(oneThirdWidth, 0, oneThirdWidth, halfHeight)
  const thirdQuarter = new Rect(oneThirdWidth * 2, 0, oneThirdWidth, halfHeight)
  const fourthQuarter = new Rect(
    oneThirdWidth * 2,
    halfHeight,
    oneThirdWidth,
    halfHeight
  )

  // Store unique regions (no duplicates)
  const regions = [
    firstQuarter,
    secondQuarter,
    oneThird,
    thirdQuarter,
    fourthQuarter,
  ]

  // Map indices to lightstrip positions (with duplicates)
  // This allows us to calculate mean() only once per unique region
  const indices = [0, 1, 1, 2, 3, 3, 4]

  return { regions, indices }
}

export default splitIntoLightstripGradientRegions
