/** Draw a source image into a canvas no larger than maxDim, and return a JPEG blob. */
async function resize(file: Blob, maxDim: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process that image.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not process that image.'))),
      'image/jpeg',
      quality,
    );
  });
}

/** Big enough for the model to read the food, small enough to upload on mobile data. */
export const forAnalysis = (file: Blob) => resize(file, 1024, 0.82);

/** Small square-ish thumbnail kept in IndexedDB alongside the entry. */
export const forThumbnail = (file: Blob) => resize(file, 320, 0.7);

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = String(r.result);
      // strip the "data:image/jpeg;base64," prefix
      resolve(result.slice(result.indexOf(',') + 1));
    };
    r.onerror = () => reject(new Error('Could not read that image.'));
    r.readAsDataURL(blob);
  });
}
