import { alertSubject, renderAlertHtml, renderAlertText } from '../html';
import type { Alert, AlertDelivery } from '../types';

// Resend delivery for support alerts (plan §6.1) — the AlertDelivery
// implementation for the real AWS wiring. Same provider + API shape as the
// analytics-report sender (src/lib/analytics-report/resend-sender.ts): one
// HTTPS call, no SDK dependency, fetch injected so unit tests can mock it.
// Recipients are the ANALYTICS_ADMIN_EMAILS allowlist; the from-address must
// be on the Resend-verified domain (octavlearning.com).
//
// Failure semantics (§6.1/§11): a non-2xx THROWS — the handler catches it per
// alert (persist-first, delivery best-effort: log + continue, never retried).

export class ResendAlertDelivery implements AlertDelivery {
  constructor(
    private readonly recipients: string[],
    private readonly apiKey: string,
    private readonly fromAddress: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async deliver(alert: Alert): Promise<void> {
    const res = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Octav Learning <${this.fromAddress}>`,
        to: this.recipients,
        subject: alertSubject(alert),
        html: renderAlertHtml(alert),
        text: renderAlertText(alert),
      }),
    });
    if (!res.ok) {
      // Status + body snippet only — never the API key (the auth M1 lesson).
      const detail = await res.text().catch(() => '');
      throw new Error(`[support-bot] send failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
  }
}
