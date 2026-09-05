import { describe, it, expect } from 'vitest';
import {
  devGateDenied,
  devGateDeniesEmail,
  isDevRequest,
  parseAllowedEmails,
  isDevAllowedEmail,
  DEV_GATE_ERROR,
} from '@/lib/auth/dev-gate';

const ALLOW = 'yong.ouyang@gmail.com, evanling@gmail.com, louise.rx.ouyang@gmail.com, gzkerry@hotmail.com';

const devReq = (headers: Record<string, string> = {}) =>
  new Request('https://dev.octavlearning.com/api/progress', { headers });
const prodReq = () => new Request('https://octavlearning.com/api/progress');

describe('isDevRequest', () => {
  it('is true only for the dev marker header', () => {
    expect(isDevRequest(devReq({ 'x-octav-env': 'dev' }))).toBe(true);
    expect(isDevRequest(devReq({ 'x-octav-env': 'DEV' }))).toBe(true);
    expect(isDevRequest(devReq())).toBe(false);
    expect(isDevRequest(devReq({ 'x-octav-env': 'prod' }))).toBe(false);
    expect(isDevRequest(prodReq())).toBe(false);
  });

  // NOTE: the code trusts this header, so the real protection is upstream — the
  // CloudFront viewer-request Function must OVERWRITE any client-supplied
  // value. That is asserted by the infra, not by this unit test.
  it('reads the header (CloudFront is responsible for overwriting client values)', () => {
    expect(isDevRequest(devReq({ 'x-octav-env': 'dev' }))).toBe(true);
  });
});

describe('parseAllowedEmails', () => {
  it('trims, lowercases, dedupes and drops empties', () => {
    expect(parseAllowedEmails(' A@x.com , a@x.com ,, B@x.com ')).toEqual(['a@x.com', 'b@x.com']);
    expect(parseAllowedEmails(undefined)).toEqual([]);
    expect(parseAllowedEmails('')).toEqual([]);
  });
});

describe('isDevAllowedEmail', () => {
  it('matches case-insensitively and rejects missing emails', () => {
    expect(isDevAllowedEmail('YONG.OUYANG@GMAIL.COM', parseAllowedEmails(ALLOW))).toBe(true);
    expect(isDevAllowedEmail('stranger@example.com', parseAllowedEmails(ALLOW))).toBe(false);
    expect(isDevAllowedEmail(undefined, parseAllowedEmails(ALLOW))).toBe(false);
  });
});

describe('devGateDenied', () => {
  it('never blocks a non-DEV request (prod is untouched)', () => {
    expect(devGateDenied(prodReq(), 'stranger@example.com', ALLOW)).toBe(false);
    expect(devGateDenied(devReq({ 'x-octav-env': 'dev' }), 'stranger@example.com', ALLOW)).toBe(true);
  });

  it('allows the 4 allowlisted accounts on DEV', () => {
    for (const email of [
      'yong.ouyang@gmail.com',
      'evanling@gmail.com',
      'louise.rx.ouyang@gmail.com',
      'gzkerry@hotmail.com',
    ]) {
      expect(devGateDenied(devReq({ 'x-octav-env': 'dev' }), email, ALLOW)).toBe(false);
    }
  });

  it('blocks any other account on DEV', () => {
    expect(devGateDenied(devReq({ 'x-octav-env': 'dev' }), 'someone@example.com', ALLOW)).toBe(true);
  });

  it('is INERT when the allowlist is empty (never locks the team out)', () => {
    expect(devGateDenied(devReq({ 'x-octav-env': 'dev' }), 'anyone@example.com', '')).toBe(false);
    expect(devGateDenied(devReq({ 'x-octav-env': 'dev' }), 'anyone@example.com', undefined)).toBe(false);
  });

  it('exposes the error code handlers return', () => {
    expect(DEV_GATE_ERROR).toBe('dev_allowlist');
  });
});

describe('devGateDeniesEmail (request-otp path)', () => {
  it('mirrors the session gate so non-allowlisted addresses never get a DEV session', () => {
    expect(devGateDeniesEmail(devReq({ 'x-octav-env': 'dev' }), 'yong.ouyang@gmail.com', ALLOW)).toBe(false);
    expect(devGateDeniesEmail(devReq({ 'x-octav-env': 'dev' }), 'stranger@example.com', ALLOW)).toBe(true);
    expect(devGateDeniesEmail(prodReq(), 'stranger@example.com', ALLOW)).toBe(false);
  });
});
