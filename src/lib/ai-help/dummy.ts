import type { AiHelpProvider, AiHelpRequest, AiHelpResult } from './types';

export class DummyAiHelpProvider implements AiHelpProvider {
  constructor(private readonly response?: AiHelpResult) {}

  async help(req: AiHelpRequest): Promise<AiHelpResult> {
    if (this.response) return this.response;
    return { help: `Dummy AI help for ${req.action}: review the worked explanation, then try a similar question.` };
  }
}
