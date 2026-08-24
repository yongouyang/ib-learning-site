import type { ReportEmailSender } from './types';

// No-op sender for the dummy wiring (local dev/e2e with zero AWS resources —
// the controllable-dummy directive). Records nothing; the report handler still
// computes the data and logs the result envelope, so a local run exercises the
// full path except the network call.

export class DummyReportSender implements ReportEmailSender {
  async send(_args: { to: string[]; subject: string; html: string; text: string }): Promise<void> {
    // no-op
  }
}
