import type { ArtworkFingerprint } from "./artwork";

/**
 * Read a painting on a canvas, without a model and without uploading anything.
 *
 * The numbers here are measurements, not opinions: luminance, contrast, colour
 * spread, edge density and where the weight sits. The downscaled JPEG exists
 * only so an opt-in vision model can look at the same image the painter saw.
 */

const SAMPLE_SIZE = 96;
const UPLOAD_MAX = 768;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("could not decode that image"));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hex(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0");
}

export async function readArtwork(file: File): Promise<{
  fingerprint: ArtworkFingerprint;
  image: string;
}> {
  if (!file.type.startsWith("image/")) throw new Error("choose an image file");
  const source = await loadImage(file);
  const width = Math.min(20000, Math.max(1, source.naturalWidth));
  const height = Math.min(20000, Math.max(1, source.naturalHeight));
  const scale = Math.min(1, SAMPLE_SIZE / Math.max(width, height));
  const sampleWidth = Math.max(1, Math.round(width * scale));
  const sampleHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx === null) throw new Error("canvas is unavailable in this browser");
  ctx.drawImage(source, 0, 0, sampleWidth, sampleHeight);
  const pixels = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;

  let luminanceSum = 0;
  let luminanceSq = 0;
  let saturationSum = 0;
  let warmthSum = 0;
  let leftSum = 0;
  let topSum = 0;
  let edges = 0;
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();

  const lum = (index: number): number => {
    const r = (pixels[index] ?? 0) / 255;
    const g = (pixels[index + 1] ?? 0) / 255;
    const b = (pixels[index + 2] ?? 0) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const index = (y * sampleWidth + x) * 4;
      const r = pixels[index] ?? 0;
      const g = pixels[index + 1] ?? 0;
      const b = pixels[index + 2] ?? 0;
      const light = lum(index);
      luminanceSum += light;
      luminanceSq += light * light;
      saturationSum += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
      warmthSum += (r - b) / (r + b + 1);
      if (x < sampleWidth / 2) leftSum += light;
      if (y < sampleHeight / 2) topSum += light;

      if (x + 1 < sampleWidth && y + 1 < sampleHeight) {
        const right = lum(index + 4);
        const down = lum(index + sampleWidth * 4);
        if (Math.abs(light - right) + Math.abs(light - down) > 0.14) edges += 1;
      }

      // Three bits per channel: coarse enough to group brush colours, fine
      // enough to keep ochre distinct from umber.
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count += 1;
      buckets.set(key, bucket);
    }
  }

  const total = sampleWidth * sampleHeight;
  const mean = luminanceSum / total;
  const variance = Math.max(0, luminanceSq / total - mean * mean);
  const palette = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(
      (bucket) =>
        `#${hex(bucket.r / bucket.count)}${hex(bucket.g / bucket.count)}${hex(bucket.b / bucket.count)}`,
    );

  const fingerprint: ArtworkFingerprint = {
    width,
    height,
    palette: palette.length > 0 ? palette : ["#232419"],
    meanLuminance: clamp01(mean),
    contrast: clamp01(Math.sqrt(variance) * 2.2),
    saturation: clamp01(saturationSum / total),
    warmth: Math.max(-1, Math.min(1, warmthSum / total)),
    edgeDensity: clamp01(edges / total),
    balance: {
      left: clamp01(leftSum / Math.max(1e-6, luminanceSum)),
      top: clamp01(topSum / Math.max(1e-6, luminanceSum)),
    },
  };

  // A second, smaller canvas for the image that may be sent to the vision model.
  const uploadScale = Math.min(1, UPLOAD_MAX / Math.max(width, height));
  const upload = document.createElement("canvas");
  upload.width = Math.max(1, Math.round(width * uploadScale));
  upload.height = Math.max(1, Math.round(height * uploadScale));
  const uploadCtx = upload.getContext("2d");
  if (uploadCtx === null) throw new Error("canvas is unavailable in this browser");
  uploadCtx.drawImage(source, 0, 0, upload.width, upload.height);

  return { fingerprint, image: upload.toDataURL("image/jpeg", 0.72) };
}
