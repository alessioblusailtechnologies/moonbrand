const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('immagine illeggibile'));
    };
    image.src = url;
  });
}

export async function resizedDataUri(file: File, maxSide: number, type: 'image/png' | 'image/jpeg'): Promise<string> {
  if (!ACCEPTED.includes(file.type) && file.type !== 'image/svg+xml') throw new Error('formato');
  const image = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || maxSide, image.naturalHeight || maxSide));
  const width = Math.max(1, Math.round((image.naturalWidth || maxSide) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || maxSide) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  if (type === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL(type, 0.86);
}
