import { normalizeVietnamese } from '../lib/normalize';

describe('normalizeVietnamese', () => {
  it('strips diacritics per the mandatory test matrix', () => {
    expect(normalizeVietnamese('Việt')).toBe('viet');
    expect(normalizeVietnamese('Đà Nẵng')).toBe('da nang');
    expect(normalizeVietnamese('Tôi')).toBe('toi');
    expect(normalizeVietnamese('Cà phê')).toBe('ca phe');
    expect(normalizeVietnamese('TypeScript')).toBe('typescript');
  });

  it('handles mixed and empty input', () => {
    expect(normalizeVietnamese('')).toBe('');
    expect(normalizeVietnamese('   ')).toBe('');
    expect(normalizeVietnamese('Việt Nam hôm nay')).toBe('viet nam hom nay');
  });
});
