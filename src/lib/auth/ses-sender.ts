import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { EmailSender } from './types';
import { OTP_EMAIL_SUBJECT, otpEmailHtml, otpEmailText } from './otp-email';

// Production email delivery: SES v2 from the verified octavlearning.com
// identity (terraform/modules/ses). The client must target ap-southeast-1 —
// SES has no ap-east-1 endpoint (architecture-evolution-plan.md Constraint 2).
// Sandbox mode still delivers to verified addresses, so the OTP flow is
// end-to-end testable before AWS grants production access. The email content
// itself lives in ./otp-email.ts, shared with the Resend provider swap.

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
