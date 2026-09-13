import { describe, it, expect } from 'vitest';
import { formatAmount, formatChargeDate, renderTrialEndingEmail } from '@/lib/subscriptions/email';

// The trial-ending reminder is the email that stands between a free trial and a
// chargeback ("I didn't know it would charge me"). So the properties worth
// pinning are the ones that prevent a surprise: the DATE, the AMOUNT, the CARD,
// and a route to cancel — plus honest degradation when Stripe gave us no price.

const BASE = {
  displayName: 'Alex',
  chargeDate: '27 September 2026',
  amountLabel: 'US$20.00',
  cardLine: 'Visa ending 4242',
  planLabel: 'Monthly',
  accountUrl: 'https://octavlearning.com/account',
};

describe('renderTrialEndingEmail', () => {
  it('states the date, the amount and the card in both bodies', () => {
    const { subject, html, text } = renderTrialEndingEmail(BASE);
    expect(subject).toBe('Your free trial ends on 27 September 2026');
    for (const body of [text, html]) {
      expect(body).toContain('27 September 2026');
      expect(body).toContain('US$20.00');
      expect(body).toContain('Visa ending 4242');
      expect(body).toContain('Nothing is charged before then');
      expect(body).toContain('https://octavlearning.com/account');
    }
  });

  it('never repeats the charge date inside one sentence', () => {
    // Caught by reading the RENDERED email, not by a unit test: the first
    // version produced "On that date … we'll charge US$20.00 on 27 September
    // 2026 to Visa ending 4242" — the date twice in one sentence.
    const { text } = renderTrialEndingEmail(BASE);
    expect(text).toContain("On that date we'll charge US$20.00 to Visa ending 4242.");
    expect(text).not.toMatch(/charge US\$20\.00 on 27 September/);
  });

  it('degrades to readable English when the amount and/or card are unknown', () => {
    // A webhook whose price was not expanded, or an older subscription object:
    // better to say less than to print "$null" — and it must still be a sentence.
    const noAmount = renderTrialEndingEmail({ ...BASE, amountLabel: null });
    expect(noAmount.text).toContain("we'll charge the card on file (Visa ending 4242)");

    const noCard = renderTrialEndingEmail({ ...BASE, cardLine: null });
    expect(noCard.text).toContain("we'll charge US$20.00");

    const neither = renderTrialEndingEmail({ ...BASE, amountLabel: null, cardLine: null });
    expect(neither.text).toContain('your subscription will continue at the same price');

    for (const r of [noAmount, noCard, neither]) {
      for (const body of [r.text, r.html]) {
        expect(body).not.toContain('null');
        expect(body).toContain('27 September 2026');
      }
      expect(r.text).not.toMatch(/charge\s{2,}|charge\s*\./);
    }
  });

  it('greets without a name rather than saying "Hi ,"', () => {
    const { text } = renderTrialEndingEmail({ ...BASE, displayName: null });
    expect(text.startsWith('Hi,')).toBe(true);
    const blank = renderTrialEndingEmail({ ...BASE, displayName: '   ' });
    expect(blank.text.startsWith('Hi,')).toBe(true);
  });

  it('escapes the account name and card line into the HTML', () => {
    const { html } = renderTrialEndingEmail({ ...BASE, displayName: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('always tells the customer they can cancel before the charge', () => {
    const { text } = renderTrialEndingEmail(BASE);
    expect(text).toMatch(/cancel any time before 27 September 2026/i);
    expect(text).toMatch(/won't be charged|won’t be charged/i);
  });
});

describe('formatAmount', () => {
  it('renders minor units in the price currency', () => {
    // en-GB deliberately writes USD as "US$…": for a Hong-Kong-based business
    // charging USD, a bare "$" is exactly the ambiguity the reminder email must
    // not have. (The /pricing copy still says "$20 per month"; if that is ever
    // revisited, matching it to US$ would remove the same ambiguity there.)
    expect(formatAmount(2000, 'usd')).toBe('US$20.00');
    expect(formatAmount(20000, 'usd')).toBe('US$200.00');
    // Decision 12's fallback: settle in HKD — must not render as dollars.
    expect(formatAmount(2000, 'hkd')).toBe('HK$20.00');
  });

  it('returns null when the amount is unknown so the copy can omit it', () => {
    expect(formatAmount(null, 'usd')).toBeNull();
    expect(formatAmount(2000, null)).toBeNull();
    expect(formatAmount(undefined, undefined)).toBeNull();
  });

  it('falls back to a plain number for an unusable currency code instead of throwing', () => {
    // This runs inside a webhook: an unknown code must never throw there.
    expect(formatAmount(2000, 'NOTACOIN')).toBe('20.00 NOTACOIN');
  });
});

describe('formatChargeDate', () => {
  it('formats an ISO instant in en-GB, matching the rest of the site', () => {
    expect(formatChargeDate('2026-09-27T02:17:13.000Z')).toMatch(/2[67] September 2026/);
  });

  it('passes through a value it cannot parse rather than printing "Invalid Date"', () => {
    expect(formatChargeDate('not-a-date')).toBe('not-a-date');
  });
});
