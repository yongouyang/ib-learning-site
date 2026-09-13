// Trial-ending reminder email (E4.4, plan §6.4 + §2.2 guard rail).
//
// Sent when Stripe fires `customer.subscription.trial_will_end` (3 days before a
// trial converts). Its job is the one thing that turns a trial into a complaint:
// the customer must never be surprised by the first charge. So the email states
// WHICH card, the exact DATE, and the AMOUNT, and links to the place they can
// cancel — and it says plainly that cancelling before that date costs nothing.
//
// Rendering lives here (pure + unit-tested); delivery is the shared
// ReportEmailSender seam the contact/report emails already use.

export interface TrialEndingEmailArgs {
  /** Falls back to a neutral greeting when the account has no display name. */
  displayName?: string | null;
  /** "27 September 2026" — pre-formatted by the caller from the Stripe epoch. */
  chargeDate: string;
  /** "$20.00" — null when the subscription's price is unknown (older objects,
   *  or a webhook whose price was not expanded). The copy degrades to the date. */
  amountLabel: string | null;
  /** "Visa ending 4242" — null when no card is on file. */
  cardLine: string | null;
  planLabel: string | null;
  /** Absolute /account URL (the Portal entry point). */
  accountUrl: string;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderTrialEndingEmail(args: TrialEndingEmailArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = args.displayName?.trim() ? `Hi ${args.displayName.trim()},` : 'Hi,';
  const planPart = args.planLabel ? ` ${args.planLabel.toLowerCase()}` : '';

  // One charge sentence, built once so text and HTML cannot drift, and so every
  // combination of unknown amount/card still reads as English. (The first
  // version interpolated the date TWICE — "On that date … we'll charge $X on
  // <date>" — which only showed up when the rendered email was read end to end.)
  const chargeSentence = (() => {
    if (args.amountLabel && args.cardLine) return `we'll charge ${args.amountLabel} to ${args.cardLine}`;
    if (args.amountLabel) return `we'll charge ${args.amountLabel}`;
    if (args.cardLine) return `we'll charge the card on file (${args.cardLine})`;
    return 'your subscription will continue at the same price';
  })();

  const subject = `Your free trial ends on ${args.chargeDate}`;

  const text = `${greeting}

Your Octav Learning${planPart} free trial ends on ${args.chargeDate}.

On that date ${chargeSentence}. Nothing is charged before then.

If you'd rather not continue, cancel any time before ${args.chargeDate} and you won't be charged — you keep full Premium access until then:

${args.accountUrl}

— Octav Learning`;

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#2563eb;color:#ffffff;padding:20px 24px;">
        <h1 style="margin:0;font-size:18px;font-weight:700;">Your trial ends on ${esc(args.chargeDate)}</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Octav Learning Premium</p>
      </div>
      <div style="padding:24px;color:#111827;font-size:14px;line-height:1.6;">
        <p style="margin:0 0 12px;">${esc(greeting)}</p>
        <p style="margin:0 0 12px;">Your Octav Learning${esc(planPart)} free trial ends on <strong>${esc(args.chargeDate)}</strong>.</p>
        <div style="padding:16px;background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;margin:0 0 16px;">
          <p style="margin:0 0 6px;"><strong>On ${esc(args.chargeDate)} ${esc(chargeSentence)}</strong></p>
          <p style="margin:0;color:#4b5563;font-size:13px;">Nothing is charged before then.</p>
        </div>
        <p style="margin:0 0 16px;">If you&rsquo;d rather not continue, cancel any time before ${esc(args.chargeDate)} and you won&rsquo;t be charged — you keep full Premium access until then.</p>
        <p style="margin:0 0 8px;">
          <a href="${esc(args.accountUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Manage your subscription</a>
        </p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #f3f4f6;font-size:12px;color:#6b7280;">
        You&rsquo;re receiving this because you started a free trial on Octav Learning. Manage or cancel any time from your account.
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * "20.00 USD" → "$20.00" (and "20.00 HKD" → "HK$20.00") using Intl rather than a
 * hand-rolled table, so a non-USD price (decision 12's fallback) still renders
 * sensibly. Returns null when the amount is unknown, which the copy tolerates.
 */
export function formatAmount(unitAmount: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof unitAmount !== 'number' || !currency) return null;
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(unitAmount / 100);
  } catch {
    // Unknown/invalid currency code: show the number with the raw code rather
    // than throwing inside a webhook.
    return `${(unitAmount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/** "2026-09-27T02:17:13.000Z" → "27 September 2026" (en-GB, matching the site). */
export function formatChargeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
