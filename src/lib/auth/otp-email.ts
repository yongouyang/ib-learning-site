// Shared OTP email content for every real EmailSender implementation (SES
// today, Resend as the provider-swap option — PROGRESS.md 2026-08-18 option b).
// Branded but deliberately simple (architecture-evolution-plan.md §6.5): no
// external images or links, inline styles only — keeps deliverability high and
// the spam score low. Callers interpolate the code and must never log it.

export const OTP_EMAIL_SUBJECT = 'Your Octav Learning sign-in code';

export function otpEmailHtml(code: string, expiresInMinutes: number): string {
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

export function otpEmailText(code: string, expiresInMinutes: number): string {
  return [
    'Octav Learning',
    '',
    `Your sign-in code is ${code}. It expires in ${expiresInMinutes} minutes.`,
    '',
    "If you didn't ask for this code, you can safely ignore this email.",
  ].join('\n');
}
