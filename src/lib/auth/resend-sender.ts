import type { EmailSender } from './types';
import { OTP_EMAIL_SUBJECT, otpEmailHtml, otpEmailText } from './otp-email';

// Provider-swap email delivery (option b for the denied SES production access —
// see PROGRESS.md 2026-08-18). Resend's transactional API: one HTTPS call, no
// SDK dependency — Node's global fetch is injected so unit tests can mock it.
// The from-address must be on a domain verified in Resend (octavlearning.com).

export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async sendOtpEmail(args: { to: string; code: string; expiresInMinutes: number }): Promise<void> {
    const res = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Octav Learning <${this.fromAddress}>`,
        to: [args.to],
        subject: OTP_EMAIL_SUBJECT,
        html: otpEmailHtml(args.code, args.expiresInMinutes),
        text: otpEmailText(args.code, args.expiresInMinutes),
      }),
    });
    if (!res.ok) {
      // Status + body snippet only — never the API key (review M1 spirit).
      const detail = await res.text().catch(() => '');
      throw new Error(`[resend] send failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
  }
}
