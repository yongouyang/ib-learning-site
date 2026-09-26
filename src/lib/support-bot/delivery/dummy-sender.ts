import type { Alert, AlertDelivery } from '../types';

// Recording dummy delivery — the controllable-dummy directive (AGENTS.md):
// local dev and e2e run with zero emails. Records every delivered alert (the
// DummyStripeClient takeEvents precedent); `failNext` injects a one-shot
// delivery failure so the handler's best-effort path is exercisable in tests.

export class DummyAlertDelivery implements AlertDelivery {
  readonly sent: Alert[] = [];
  /** When true, the next deliver() throws once, then clears itself. */
  failNext = false;

  async deliver(alert: Alert): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('[support-bot] dummy delivery failure (injected)');
    }
    this.sent.push({ ...alert });
  }
}
