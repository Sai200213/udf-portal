// Grayscale helper
const getGrayscale = (pixels: Uint8ClampedArray, width: number, height: number): Float32Array => {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
};

/**
 * Calculates client-side image blur using Laplacian Variance.
 * A score below 12.0 generally indicates standard text is blurry or out-of-focus.
 */
export const checkImageBlurry = (imgElement: HTMLImageElement): { score: number; isBlurry: boolean } => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { score: 0, isBlurry: false };

  // Safety validation
  if (!imgElement.naturalWidth || !imgElement.naturalHeight) {
    console.warn("checkImageBlurry: Image has 0 or invalid natural dimensions");
    return { score: 0, isBlurry: false };
  }

  // Downscale image for speed and to reduce high-frequency noise
  const width = 200;
  const height = Math.round((200 * imgElement.naturalHeight) / imgElement.naturalWidth);
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(imgElement, 0, 0, width, height);

  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const gray = getGrayscale(imgData.data, width, height);

    // Apply 3x3 Laplacian Kernel:
    // [ 0,  1,  0,
    //   1, -4,  1,
    //   0,  1,  0 ]
    const laplacian = new Float32Array(width * height);
    let sum = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const val =
          gray[idx - width] + // top
          gray[idx - 1] +     // left
          -4 * gray[idx] +    // center
          gray[idx + 1] +     // right
          gray[idx + width];  // bottom

        laplacian[idx] = val;
        sum += val;
        count++;
      }
    }

    const mean = sum / count;
    let varianceSum = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const diff = laplacian[idx] - mean;
        varianceSum += diff * diff;
      }
    }

    const score = varianceSum / count;
    const threshold = 50.0; // Calibrated for document photos
    console.debug(`Blur score: ${score.toFixed(2)} (threshold: ${threshold})`);
    return {
      score: Math.round(score * 100) / 100,
      isBlurry: score < threshold
    };
  } catch (e) {
    console.error("Failed to extract image data for blur check:", e);
    return { score: 0, isBlurry: false };
  }
};

/**
 * Basic document bounds detector using adaptive brightness thresholding.
 * Extracts the bounding box of a bright rectangular document placed on a darker background.
 */
export const detectDocumentBounds = (
  imgElement: HTMLImageElement
): { x: number; y: number; width: number; height: number } | null => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Safety validation
  if (!imgElement.naturalWidth || !imgElement.naturalHeight) {
    console.warn("detectDocumentBounds: Image has 0 or invalid natural dimensions");
    return null;
  }

  // Downscale to 300px width for fast computation
  const width = 300;
  const height = Math.round((300 * imgElement.naturalHeight) / imgElement.naturalWidth);
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(imgElement, 0, 0, width, height);

  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Calculate average brightness
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    const avgBrightness = totalBrightness / (width * height);
    const threshold = Math.max(100, avgBrightness * 1.1); // Dynamic bright threshold

    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let found = 0;

    // Leaving a 5% margin to avoid camera bezel lines or container bounds
    const marginX = Math.round(width * 0.05);
    const marginY = Math.round(height * 0.05);

    for (let y = marginY; y < height - marginY; y++) {
      for (let x = marginX; x < width - marginX; x++) {
        const idx = (y * width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        if (brightness > threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found++;
        }
      }
    }

    // Ensure the detected bright zone is large enough to be a document (at least 15% area)
    if (found > (width * height * 0.15) && maxX > minX && maxY > minY) {
      return {
        x: minX / width,
        y: minY / height,
        width: (maxX - minX) / width,
        height: (maxY - minY) / height
      };
    }
  } catch (e) {
    console.error("Failed to run document boundary detection:", e);
  }

  return null;
};
