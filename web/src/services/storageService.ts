import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import app from './firebase';

const storage = getStorage(app);

// Downscale and re-encode as JPEG so avatars and cover art stay small
async function resizeToJpeg(dataUrl: string, maxSize: number): Promise<Blob> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))), 'image/jpeg', 0.85)
  );
}

/**
 * Upload an image (given as a data: URL) to Firebase Storage under `folder` and
 * return its download URL. Values that are already remote URLs pass through.
 *
 * If the upload fails (e.g. Storage not enabled or rules not deployed) the
 * original data URL is returned so saving still works the old, inline way.
 */
export async function storeImage(dataUrl: string, folder: string, maxSize: number): Promise<string> {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  try {
    const blob = await resizeToJpeg(dataUrl, maxSize);
    const objectRef = ref(storage, `${folder}/${crypto.randomUUID()}.jpg`);
    await uploadBytes(objectRef, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' });
    return await getDownloadURL(objectRef);
  } catch (error) {
    console.error('Image upload to Storage failed; storing inline instead:', error);
    return dataUrl;
  }
}

export const AVATAR_MAX_SIZE = 512;
export const COVER_ART_MAX_SIZE = 1024;
