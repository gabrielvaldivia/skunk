// Player photos are stored inline on the player record, which everyone
// downloads on load, so they're kept small: a centred square JPEG, 256px (big
// enough for the largest avatar, 96px, on a 2x+ screen).
const PHOTO_SIZE = 256;

/** Base64 JPEG (no data: prefix) of the image at `src`, centre-cropped square */
export async function squarePhotoBase64(src: string, crossOrigin?: "anonymous"): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = crossOrigin;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't load photo"));
    image.src = src;
  });
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const size = Math.min(PHOTO_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas
    .getContext("2d")!
    .drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

/**
 * JPEG data URL of the image at `src`, scaled down to fit `maxPx` on its
 * longest side. Game covers are stored inline on the game record too.
 */
export async function fitImageDataUrl(src: string, maxPx: number, quality = 0.88): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't load image"));
    image.src = src;
  });
  const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
