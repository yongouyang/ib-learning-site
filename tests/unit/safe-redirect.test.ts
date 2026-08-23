import { describe, it, expect } from 'vitest';
import { sanitizeReturnPath, loginHref } from '@/lib/safe-redirect';

// The post-login return URL (/login?next=...) is attacker-influenced input —
// only same-site paths may survive (open-redirect guard).

describe('sanitizeReturnPath', () => {
  it('accepts ordinary same-site paths', () => {
    expect(sanitizeReturnPath('/')).toBe('/');
    expect(sanitizeReturnPath('/papers')).toBe('/papers');
    expect(sanitizeReturnPath('/admin/analytics')).toBe('/admin/analytics');
    expect(sanitizeReturnPath('/subjects/math/math-yr7-money-finance')).toBe(
      '/subjects/math/math-yr7-money-finance'
    );
  });

  it('accepts paths with query strings and hashes', () => {
    expect(sanitizeReturnPath('/exams?tab=mocks')).toBe('/exams?tab=mocks');
    expect(sanitizeReturnPath('/pricing#premium')).toBe('/pricing#premium');
  });

  it('falls back to / for missing values', () => {
    expect(sanitizeReturnPath(null)).toBe('/');
    expect(sanitizeReturnPath(undefined)).toBe('/');
    expect(sanitizeReturnPath('')).toBe('/');
    expect(sanitizeReturnPath('   ')).toBe('/');
    expect(sanitizeReturnPath([])).toBe('/');
  });

  it('uses the first value when given an array', () => {
    expect(sanitizeReturnPath(['/exams', '/papers'])).toBe('/exams');
    expect(sanitizeReturnPath(['//evil.com', '/exams'])).toBe('/');
  });

  it('rejects absolute URLs and other schemes', () => {
    expect(sanitizeReturnPath('https://evil.com')).toBe('/');
    expect(sanitizeReturnPath('http://evil.com/login')).toBe('/');
    expect(sanitizeReturnPath('javascript:alert(1)')).toBe('/');
    expect(sanitizeReturnPath('evil.com/path')).toBe('/');
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeReturnPath('//evil.com')).toBe('/');
    expect(sanitizeReturnPath('///evil.com')).toBe('/');
  });

  it('rejects backslash smuggling', () => {
    expect(sanitizeReturnPath('/\\evil.com')).toBe('/');
    expect(sanitizeReturnPath('/papers\\..\\admin')).toBe('/');
  });

  it('rejects control characters and embedded whitespace', () => {
    expect(sanitizeReturnPath('/papers\t/x')).toBe('/');
    expect(sanitizeReturnPath('/papers\n/x')).toBe('/');
    expect(sanitizeReturnPath('/papers /x')).toBe('/');
    expect(sanitizeReturnPath('/papers\u0000')).toBe('/');
  });

  it('rejects over-long values', () => {
    expect(sanitizeReturnPath('/' + 'a'.repeat(3000))).toBe('/');
  });

  it('rejects the login page itself (no self-redirect loop)', () => {
    expect(sanitizeReturnPath('/login')).toBe('/');
    expect(sanitizeReturnPath('/login?next=/papers')).toBe('/');
    expect(sanitizeReturnPath('/login#x')).toBe('/');
    expect(sanitizeReturnPath('/loginish')).toBe('/loginish'); // different route — allowed
  });

  it('trims surrounding whitespace before validating', () => {
    expect(sanitizeReturnPath('  /exams  ')).toBe('/exams');
  });
});

describe('loginHref', () => {
  it('builds an encoded ?next= link for real targets', () => {
    expect(loginHref('/papers/math-ks3-core/set-1')).toBe(
      '/login?next=%2Fpapers%2Fmath-ks3-core%2Fset-1'
    );
    expect(loginHref('/admin/analytics')).toBe('/login?next=%2Fadmin%2Fanalytics');
  });

  it('returns a plain /login link when there is nowhere to return to', () => {
    expect(loginHref('/')).toBe('/login');
    expect(loginHref('/login')).toBe('/login');
    expect(loginHref('https://evil.com')).toBe('/login');
    expect(loginHref('')).toBe('/login');
  });
});
