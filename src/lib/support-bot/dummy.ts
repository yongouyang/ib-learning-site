import type { ContactMessage } from '../contact/types';
import { InMemoryContactStorage } from '../contact/dummy';
import type { Alert, SupportBotStorage } from './types';

// In-memory support-bot dummy (docs/support-bot-plan.md) — the
// controllable-dummy directive (AGENTS.md): tests run against this with zero
// AWS resources. It EXTENDS the contact dummy (which extends leaderboard →
// feedback → analytics → progress → auth), so contact messages written
// through saveContactMessage and analytics aggregates written through
// recordEvent are readable by the bot's polls from the SAME universe — a
// contact form submission in dev is visible to the bot exactly the way the
// production Scan sees the octav-contact row.
//
// NOTE (universe topology): this is a BRANCH off the chain at the contact
// level — it does NOT include the subscriptions/content state that
// InMemoryContentStorage (the getSharedDummyUniverse() type) adds above
// contact, none of which the bot reads. If a future phase needs the bot's
// universe to BE the shared one (e.g. a dev entry point that must see
// messages submitted via /api/contact in the same process), extend the chain
// again (content → support-bot) and re-point getSharedDummyUniverse.
//
// Every op mirrors the DynamoDB adapter's semantics EXACTLY (same conditional
// putAlert outcome, same status filter, same aggregate window) — the parity
// test drives both against a simulated DynamoDB implementation.

export class InMemorySupportBotStorage extends InMemoryContactStorage implements SupportBotStorage {
  private readonly alerts = new Map<string, Alert>(); // alertId → row

  constructor(clock: () => number = Date.now) {
    super(clock);
  }

  // --- Alerts -------------------------------------------------------------------

  async getAlert(alertId: string): Promise<Alert | null> {
    const alert = this.alerts.get(alertId);
    return alert ? { ...alert } : null;
  }

  async putAlert(alert: Alert): Promise<boolean> {
    // Mirrors the adapter's ConditionExpression exactly:
    // attribute_not_exists(alertId) OR status = "resolved".
    const existing = this.alerts.get(alert.alertId);
    if (existing && existing.status !== 'resolved') return false;
    this.alerts.set(alert.alertId, { ...alert });
    return true;
  }

  async probeSupportAlertsTable(): Promise<void> {
    // The in-memory dummy has no IAM/table to fail — the probe is a no-op
    // (its DynamoDB counterpart performs the GetItem).
  }

  // --- Source polls ---------------------------------------------------------------

  async listNewContactMessages(): Promise<ContactMessage[]> {
    // The adapter's filtered Scan equivalent: status = "new" only.
    return this.listContactMessages().filter((m) => m.status === 'new');
  }

  async getAggregatesBetween(fromDate: string, toDate: string): Promise<Array<{ s: string; count: number }>> {
    // The analytics dummy's accessor (inherited) is synchronous; the
    // SupportBotStorage contract is async — same rows either way.
    return super.getAggregatesBetween(fromDate, toDate);
  }

  // --- Test helpers (dummy-only) ----------------------------------------------------

  /** All stored alerts (tests assert on the resulting array). */
  listAlerts(): Alert[] {
    return [...this.alerts.values()].map((a) => ({ ...a }));
  }
}
