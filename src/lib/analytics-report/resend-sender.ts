import type { ReportEmailSender } from './types';

// Resend delivery for the daily analytics report. Same provider + API shape as
// the auth OTP sender (src/lib/auth/resend-sender.ts) but with a generic
// html/text payload — one HTTPS call, no SDK dependency; the fetch
// implementation is injected so unit tests can mock it. The from-address must
// be on a domain verified in Resend (octavlearning.com).

export class ResendReportSender implements ReportEmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async send(args: { to: string[]; subject: string; html: string; text: string }): Promise<void> {
    const res = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Octav Learning <${this.fromAddress}>`,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      // Status + body snippet only — never the API key (the auth M1 lesson).
      const detail = await res.text().catch(() => '');
      throw new Error(`[analytics-report] send failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
  }
}
