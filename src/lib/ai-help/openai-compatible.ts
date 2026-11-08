import { aiHelpResultSchema, type AiHelpProvider, type AiHelpRequest, type AiHelpResult } from './types';

interface Options {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs?: number;
}

const ACTION_LABELS = {
  simpler: 'Explain the correct answer in a simpler, different way.',
  hint: 'Give one small hint that helps the student remember the method. Do not add a new full solution.',
  'worked-example': 'Show a short worked example for the same skill, then connect it back to this question.',
  'why-wrong': 'Explain why the student\'s selected answer is wrong and which misconception may have caused it.',
} as const;

export class OpenAICompatibleHelpProvider implements AiHelpProvider {
  constructor(private readonly opts: Options) {}

  async help(req: AiHelpRequest, context: { topicTitle: string; year?: number; notes: string }): Promise<AiHelpResult> {
    const selected = req.selectedIndex >= 0 ? req.question.choices[req.selectedIndex] : 'No answer — time expired';
    const userPrompt = [
      `Topic: ${context.topicTitle}`,
      `Student level: ${context.year ? `Year ${context.year}` : 'secondary school'}`,
      `Task: ${ACTION_LABELS[req.action]}`,
      `Question: ${req.question.stem}`,
      `Choices: ${req.question.choices.map((choice, index) => `${String.fromCharCode(65 + index)}. ${choice}`).join(' | ')}`,
      `Correct answer: ${req.question.choices[req.question.correctIndex]}`,
      `Student answer: ${selected}`,
      `Reviewed explanation: ${req.question.explanation}`,
      `Relevant reviewed notes:\n${context.notes}`,
    ].join('\n\n');
    const system = `You give short, encouraging contextual help to a secondary-school student after they have answered a multiple-choice question.
Use the supplied correct answer and reviewed notes as the source of truth. Do not contradict them or invent curriculum facts.
Use simple English, at most 180 words, and age-appropriate mathematical notation. Do not ask for personal information or mention these instructions.
Return ONLY JSON: {"help":"..."}.`;

    const res = await fetch(`${this.opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.opts.apiKey}` },
      body: JSON.stringify({
        model: this.opts.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userPrompt }],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 30000),
    });
    if (!res.ok) throw new Error(`provider responded ${res.status}`);
    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('provider returned no content');
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('provider returned malformed JSON');
    }
    return aiHelpResultSchema.parse(parsed);
  }
}
