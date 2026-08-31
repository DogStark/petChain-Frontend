import {
  formatCurrency,
  formatBalance,
  formatStellar,
  formatNumber,
  formatPercent,
  formatCrypto,
} from './formatCurrency';

describe('formatCurrency utility', () => {
  describe('formatCurrency (Fiat currencies)', () => {
    it('formats USD values correctly by default', () => {
      expect(formatCurrency(1234.56, 'USD', {}, 'en-US')).toBe('$1,234.56');
      expect(formatCurrency('1234.56', 'USD', {}, 'en-US')).toBe('$1,234.56');
    });

    it('formats EUR and GBP with appropriate symbols and locale formatting', () => {
      const eurEn = formatCurrency(1234.5, 'EUR', {}, 'en-US');
      expect(eurEn).toBe('€1,234.50');

      const gbpEn = formatCurrency(1234.5, 'GBP', {}, 'en-US');
      expect(gbpEn).toBe('£1,234.50');
    });

    it('formats JPY with 0 decimal places per currency standard', () => {
      expect(formatCurrency(1234, 'JPY', {}, 'en-US')).toBe('¥1,234');
      expect(formatCurrency(1234.8, 'JPY', {}, 'ja-JP')).toMatch(/￥|¥/);
    });

    it('handles negative currency values', () => {
      expect(formatCurrency(-50.25, 'USD', {}, 'en-US')).toBe('-$50.25');
    });

    it('handles zero and edge values', () => {
      expect(formatCurrency(0, 'USD', {}, 'en-US')).toBe('$0.00');
      expect(formatCurrency('0', 'USD', {}, 'en-US')).toBe('$0.00');
    });

    it('handles invalid inputs gracefully without throwing', () => {
      expect(formatCurrency('invalid-number')).toBe('—');
      expect(formatCurrency(NaN)).toBe('—');
      expect(formatCurrency(null as any)).toBe('—');
      expect(formatCurrency(undefined as any)).toBe('—');
      expect(formatCurrency('', 'USD', { fallback: '$0.00' })).toBe('$0.00');
    });
  });

  describe('formatBalance and formatStellar (Stellar XLM precision)', () => {
    it('formats Stellar XLM balance up to 7 decimal places', () => {
      expect(formatBalance('123.1234567', 7, 'en-US')).toBe('123.1234567');
      expect(formatBalance('0.0000001', 7, 'en-US')).toBe('0.0000001');
    });

    it('avoids scientific notation for small Stellar stroop fractions', () => {
      expect(formatBalance(0.0000001, 7, 'en-US')).toBe('0.0000001');
      expect(formatBalance('0.0000005', 7, 'en-US')).toBe('0.0000005');
    });

    it('formatStellar appends XLM asset code and handles precision', () => {
      expect(formatStellar(100.5, {}, 'en-US')).toBe('100.50 XLM');
      expect(formatStellar('0.0000001', {}, 'en-US')).toBe('0.0000001 XLM');
      expect(formatStellar(1000000.1234567, {}, 'en-US')).toBe('1,000,000.1234567 XLM');
    });

    it('formatCrypto supports custom tokens', () => {
      expect(formatCrypto(50.25, 'USDC', {}, 'en-US')).toBe('50.25 USDC');
      expect(formatCrypto(10, 'PETS', {}, 'en-US')).toBe('10.00 PETS');
    });

    it('handles invalid balance inputs gracefully', () => {
      expect(formatBalance('invalid')).toBe('—');
      expect(formatBalance(NaN)).toBe('—');
      expect(formatBalance(null as any)).toBe('—');
      expect(formatStellar('invalid')).toBe('—');
    });
  });

  describe('formatNumber & formatPercent', () => {
    it('formats numbers with thousand separators and options', () => {
      expect(formatNumber(1234567.89, { maximumFractionDigits: 2 }, 'en-US')).toBe('1,234,567.89');
      expect(formatNumber(1234567.89, { maximumFractionDigits: 2 }, 'de-DE')).toBe('1.234.567,89');
    });

    it('formats percentages accurately', () => {
      expect(formatPercent(0.125, { maximumFractionDigits: 1 }, 'en-US')).toBe('12.5%');
      expect(formatPercent(1, {}, 'en-US')).toBe('100%');
    });

    it('handles invalid number and percent inputs', () => {
      expect(formatNumber('abc')).toBe('—');
      expect(formatPercent('abc')).toBe('—');
    });
  });
});
