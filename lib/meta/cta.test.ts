import { describe, expect, it } from 'vitest';
import { resolveMetaCtaType, _META_VALID_CTAS } from './cta';

describe('resolveMetaCtaType', () => {
  it('returns LEARN_MORE for empty / null input', () => {
    expect(resolveMetaCtaType(null)).toBe('LEARN_MORE');
    expect(resolveMetaCtaType(undefined)).toBe('LEARN_MORE');
    expect(resolveMetaCtaType('')).toBe('LEARN_MORE');
    expect(resolveMetaCtaType('   ')).toBe('LEARN_MORE');
  });

  it('passes through already-valid Meta enums (case-insensitive)', () => {
    expect(resolveMetaCtaType('LEARN_MORE')).toBe('LEARN_MORE');
    expect(resolveMetaCtaType('sign_up')).toBe('SIGN_UP');
    expect(resolveMetaCtaType('Shop Now')).toBe('SHOP_NOW');
    expect(resolveMetaCtaType('book-now')).toBe('BOOK_NOW');
  });

  it('remaps invalid aliases users often write', () => {
    expect(resolveMetaCtaType('GET_STARTED')).toBe('LEARN_MORE');
    expect(resolveMetaCtaType('START_NOW')).toBe('LEARN_MORE');
  });

  it('matches free-form labels by intent keyword', () => {
    expect(resolveMetaCtaType('GET INSTANT GTM STRATEGY')).toBe('LEARN_MORE');
    expect(resolveMetaCtaType('Apply for early access')).toBe('APPLY_NOW');
    expect(resolveMetaCtaType('Sign up free')).toBe('SIGN_UP');
    expect(resolveMetaCtaType('Register now')).toBe('SIGN_UP');
    expect(resolveMetaCtaType('Book a demo')).toBe('BOOK_NOW');
    expect(resolveMetaCtaType('Schedule a call')).toBe('BOOK_NOW');
    expect(resolveMetaCtaType('Buy now')).toBe('BUY_NOW');
    expect(resolveMetaCtaType('Get a quote today')).toBe('GET_QUOTE');
    expect(resolveMetaCtaType('Talk to sales')).toBe('CONTACT_US');
    expect(resolveMetaCtaType('Download the report')).toBe('DOWNLOAD');
  });

  it('always returns a value Meta accepts', () => {
    const samples = [
      'GET INSTANT GTM STRATEGY',
      'Try our AI',
      'Skyrocket your revenue',
      '🚀 Launch today',
      '',
      'unknown',
    ];
    for (const s of samples) {
      const out = resolveMetaCtaType(s);
      expect(_META_VALID_CTAS.has(out)).toBe(true);
    }
  });
});
