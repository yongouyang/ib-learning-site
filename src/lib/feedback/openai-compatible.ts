import { markResultSchema, type FeedbackProvider, type MarkRequest, type MarkResult } from './types';

interface OpenAICompatibleOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs?: number;
}

const SYSTEM_PROMPT = `You are a strict but fair exam marker for a student learning platform. You mark a student's free-response answer against a markscheme.

Rules:
- Award each markscheme point INDEPENDENTLY — one point per array entry, in the same order.
- Points prefixed M (method) require the correct method/approach; points prefixed A (accuracy) require a correct final value AND may only be awarded if the associated method is present; points prefixed B are independent facts/content points.
- Judge the student's answer, not its presentation. Ignore spelling/grammar unless the meaning is unclear.
- For each point, give a one-sentence comment (max 280 chars) explaining the award decision.
- End with brief overall feedback (max 1000 chars): what was good, what to revise.
- Respond ONLY with a JSON object of this exact shape, no prose around it:
{"perPoint":[{"point":"<the markscheme point>","awarded":true,"comment":"..."}],"feedback":"..."}
Do not include a "marks" field — it is computed server-side.`;

// OpenAI-compatible chat-completions provider (Moonshot/Kimi, OpenAI, …) via
// plain fetch — no SDK, small bundle, small cold start.
export class OpenAICompatibleProvider implements FeedbackProvider {
  constructor(private readonly opts: OpenAICompatibleOptions) {}

  async markAnswer(req: MarkRequest): Promise<MarkResult> {
    const userPrompt = [
      `Question: ${req.stem}`,
      ``,
      `Markscheme (${req.maxMarks} marks, one point each):`,
      ...req.markscheme.map((p, i) => `${i + 1}. ${p}`),
      ``,
      `Model answer: ${req.modelAnswer}`,
      ``,
      `Student's answer: ${req.studentAnswer}`,
    ].join('\n');

    const first = await this.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    const parsed = this.parse(first);
    if (parsed) return parsed;

    // One retry with a nudge, then give up (route maps the throw to 502).
    const retry = await this.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: first },
      { role: 'user', content: 'Return the marking ONLY as the JSON object described, no other text.' },
    ]);
    const retried = this.parse(retry);
    if (!retried) {
      throw new Error('provider returned malformed JSON twice');
    }
    return retried;
  }

  private parse(content: string): MarkResult | null {
    try {
      const json = JSON.parse(content);
      const result = markResultSchema.safeParse({ marks: 0, ...json });
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  private async chat(messages: { role: string; content: string }[]): Promise<string> {
    const res = await fetch(`${this.opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({
        model: this.opts.model,
        messages,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 30000),
    });
    if (!res.ok) {
      throw new Error(`provider responded ${res.status}`);
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('provider returned no content');
    }
    return content;
  }
}
