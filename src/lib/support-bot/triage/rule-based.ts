import type { ContactMessage, ContactSubject } from '../../contact/types';
import type {
  AnalyticsAnomalySignal,
  RawSignal,
  TriageProvider,
  TriageResult,
} from '../types';
import { truncateAlertBody, truncateAlertTitle } from '../types';

// Rule-based triage (plan §5.1 — v1 default, §9 Q4): a deterministic, pure
// mapping from signal → severity + title + body, using the §3.1/§3.2
// templates. No external dependencies, never fails. The deepseek LLM provider
// is v1.1 (§5.2) and must FALL BACK to this on any failure.
//
// Template deviations forced by the data model (recorded, same honesty-note
// class as analytics-report):
//   1. §3.1's bug_report template references "{url/path if available}" — the
//      contact form captures no page URL (ContactMessage has no url field), so
//      the template says so explicitly instead of inventing one.
//   2. §3.2's traffic_drop template says "DAU" — analytics is anonymous by
//      design (no userId/sessionId in aggregates), so DAU is not computable;
//      the prod-host EVENT volume is the proxy and the template says "events".

/** Message summary for templates: whitespace-collapsed, capped so bodies stay bounded. */
function messageSummary(message: string, max = 500): string {
  const oneLine = message.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/** "12" / "12.5" — baseline averages render with at most one decimal. */
function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function contactTriage(message: ContactMessage): TriageResult {
  const { name, email, subject, message: body, messageId } = message;
  const summary = messageSummary(body);
  const bySubject: Record<ContactSubject, TriageResult> = {
    bug_report: {
      severity: 'high',
      title: `Bug report from ${name}`,
      body:
        `User reported bug: ${summary}. Check /admin/dynamodb → octav-contact → messageId=${messageId}. ` +
        `Suggested: reproduce the reported steps (the contact form captures no page URL), ` +
        `check related Lambda logs.`,
      suggestedActions: [
        `Open /admin/dynamodb → octav-contact → messageId=${messageId}`,
        'Reproduce the reported steps',
        'Check the auth/feedback/progress Lambda logs in CloudWatch',
      ],
    },
    question: {
      severity: 'medium',
      title: `Question from ${name}`,
      body:
        `User question from ${name} (${email}): ${summary}. ` +
        `Suggested: reply via email; if recurring, consider FAQ/content update.`,
      suggestedActions: [`Reply to ${email}`, 'If recurring, consider a FAQ/content update'],
    },
    feature_request: {
      severity: 'low',
      title: `Feature request from ${name}`,
      body: `Feature request from ${name}: ${summary}. Review against roadmap; acknowledge receipt.`,
      suggestedActions: ['Review against the roadmap', `Acknowledge receipt to ${email}`],
    },
    other: {
      severity: 'medium',
      title: `Contact form message from ${name}`,
      body: `Contact form message from ${name} (${email}): ${summary}. Manual review needed.`,
      suggestedActions: [`Review in /admin/dynamodb → octav-contact → messageId=${messageId}`],
    },
  };
  return bySubject[subject];
}

function analyticsTriage(signal: AnalyticsAnomalySignal): TriageResult {
  const { kind, subjectDate, count, baseline } = signal;
  switch (kind) {
    case 'error_spike': {
      // baseline 0 with count ≥ the floor = new errors appeared; the ratio is
      // then meaningless, so render the raw count as the multiple.
      const ratio = baseline > 0 ? count / baseline : count;
      const topPaths = signal.context?.topPaths || 'none recorded';
      return {
        severity: 'critical',
        title: `Error events spiked ${fmtNum(Math.round(ratio * 10) / 10)}× on ${subjectDate}`,
        body:
          `Error events spiked ${fmtNum(Math.round(ratio * 10) / 10)}× above baseline on ${subjectDate} ` +
          `(${count} vs 7-day daily avg ${fmtNum(baseline)}). Top affected: ${topPaths}. ` +
          `Check CloudWatch logs for auth/feedback/progress Lambdas.`,
        suggestedActions: [
          'Check CloudWatch logs for the auth/feedback/progress Lambdas',
          'Correlate with the most recent deploy',
        ],
      };
    }
    case 'traffic_drop': {
      const pct = baseline > 0 ? Math.round((1 - count / baseline) * 100) : 100;
      return {
        severity: 'high',
        // Deviation: prod-host EVENT volume, not DAU (anonymous aggregates).
        title: `Prod traffic down ${pct}% on ${subjectDate}`,
        body:
          `Prod traffic dropped to ${count} events on ${subjectDate} (7-day daily avg: ${fmtNum(baseline)}). ` +
          `Possible causes: deployment regression, DNS issue, PWA service worker breakage. ` +
          `Check recent deploys + CloudFront.`,
        suggestedActions: [
          'Check the most recent deploy and its smoke checks',
          'Check CloudFront + the PWA service worker',
        ],
      };
    }
    case 'ai_quota_exhaustion':
      return {
        severity: 'medium',
        title: `${count} users hit the AI-mark quota on ${subjectDate}`,
        body:
          `${count} users hit AI-mark quota on ${subjectDate}. ` +
          `Consider tier adjustment or quota increase. Current: free=30/mo, premium=1000/mo.`,
        suggestedActions: [
          'Review tier quotas (free=30/mo, premium=1000/mo)',
          'Check whether the exhaustion is one user or many',
        ],
      };
    case 'zero_events':
      return {
        severity: 'high',
        title: `No prod analytics events on ${subjectDate}`,
        body:
          `No analytics events received from prod for the full UTC day ${subjectDate}. ` +
          `Possible: site down, CloudFront misconfiguration, analytics ingest broken. ` +
          `Check /api/analytics/_health.`,
        suggestedActions: [
          'Probe /api/analytics/_health',
          'Check CloudFront and the analytics Lambda',
        ],
      };
  }
}

/**
 * The deterministic §3 mapping. Title/body are clamped to the §4 column
 * budgets here (the provider contract), and buildAlert clamps again as a
 * second line of defence.
 */
export function ruleBasedTriage(signal: RawSignal): TriageResult {
  const result = signal.source === 'contact' ? contactTriage(signal.message) : analyticsTriage(signal);
  return {
    ...result,
    title: truncateAlertTitle(result.title),
    body: truncateAlertBody(result.body),
  };
}

/** The v1 TriageProvider (deps.ts wires this; deepseek is v1.1). */
export class RuleBasedTriageProvider implements TriageProvider {
  async triage(signal: RawSignal): Promise<TriageResult> {
    return ruleBasedTriage(signal);
  }
}
