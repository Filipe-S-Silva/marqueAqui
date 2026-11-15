// Validação de imagem por assinatura (magic bytes): o Content-Type declarado não basta.
// SVG é proibido (pode carregar script).
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export type PhotoType = 'image/jpeg' | 'image/png' | 'image/webp';

export function sniffImage(buf: Buffer): PhotoType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}
