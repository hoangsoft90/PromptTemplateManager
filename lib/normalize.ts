// lib/normalize.ts — Vietnamese diacritics-insensitive normalization.
// Strips tone marks (NFD), maps đ/Đ → d/D, lowercases, trims.

export function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip tone marks
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
