import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { EmailSender } from './types';

// Production email delivery: SES v2 from the verified octavlearning.com
// identity (terraform/modules/ses). The client must target ap-southeast-1 —
// SES has no ap-east-1 endpoint (architecture-evolution-plan.md Constraint 2).
// Sandbox mode still delivers to verified addresses, so the OTP flow is
// end-to-end testable before AWS grants production access.

const OTP_EMAIL_SUBJECT = 'Your Octav Learning sign-in code';

function otpEmailHtml(code: string, expiresInMinutes: number): string {
  // Branded but deliberately simple (§6.5): no external images or links —
  // inline styles only, which keeps deliverability high and spam-score low.
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:24px auto;background-color:#ffffff;border:1px solid #f3f4f6;border-radius:16px;padding:32px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#2563eb;">OCTAV LEARNING</p>
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Your sign-in code</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#4b5563;">
        Enter this code to sign in to Octav Learning. It expires in ${expiresInMinutes} minutes.
      </p>
      <p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;">${code}</p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
        If you didn't ask for this code, you can safely ignore this email.
      </p>
    </div>
  </body>
</html>`;
}

function otpEmailText(code: string, expiresInMinutes: number): string {
  return [
    'Octav Learning',
    '',
    `Your sign-in code is ${code}. It expires in ${expiresInMinutes} minutes.`,
    '',
    "If you didn't ask for this code, you can safely ignore this email.",
  ].join('\n');
}

export class SesEmailSender implements EmailSender {
  constructor(
    private readonly client: SESv2Client,
    private readonly fromAddress: string
  ) {}

  async sendOtpEmail(args: { to: string; code: string; expiresInMinutes: number }): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.fromAddress,
        Destination: { ToAddresses: [args.to] },
        Content: {
          Simple: {
            Subject: { Data: OTP_EMAIL_SUBJECT },
            Body: {
              Html: { Data: otpEmailHtml(args.code, args.expiresInMinutes) },
              Text: { Data: otpEmailText(args.code, args.expiresInMinutes) },
            },
          },
        },
      })
    );
  }
}
