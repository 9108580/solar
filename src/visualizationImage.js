export const VISUALIZATION_MAX_BYTES = 20 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 900000;

export function containImage(width, height, boxWidth = 1600, boxHeight = 1000) {
  if (!(width > 0 && height > 0)) throw new Error('מימדי התמונה אינם תקינים');
  const scale = Math.min(boxWidth / width, boxHeight / height);
  return { width: width * scale, height: height * scale,
    x: (boxWidth - width * scale) / 2, y: (boxHeight - height * scale) / 2 };
}

export function visualizationSrc(asset) {
  const data = asset?.dataUrl;
  return typeof data === 'string' && data.length <= MAX_DATA_URL_LENGTH &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data) ? data : null;
}

export async function readQuoteVisualization(file) {
  if (!file?.size || file.size > VISUALIZATION_MAX_BYTES) throw new Error('יש לבחור תמונה בגודל עד 20MB.');
  let blob = file;
  const heic = /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type);
  if (!heic && !/^image\//i.test(file.type) && !/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name)) {
    throw new Error('יש לבחור קובץ תמונה: JPG, PNG, WebP, GIF, BMP, AVIF או HEIC/HEIF.');
  }
  if (heic) {
    try {
      const { default: convert } = await import('heic2any');
      const converted = await convert({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      blob = Array.isArray(converted) ? converted[0] : converted;
    } catch {
      throw new Error('לא ניתן להמיר את תמונת HEIC/HEIF. יש לייצא אותה כ-JPG או PNG ולנסות שוב.');
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('לא ניתן לקרוא את התמונה. נסו JPG או PNG.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('הדפדפן אינו תומך בעיבוד תמונות.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const fit = containImage(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, fit.x, fit.y, fit.width, fit.height);
    for (const quality of [0.88, 0.75, 0.6, 0.45]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const asset = { fileName: file.name, dataUrl };
      if (visualizationSrc(asset)) return asset;
    }
    throw new Error('התמונה מורכבת מדי לשמירה. נסו תמונה קטנה יותר.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
