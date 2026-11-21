export type SpeechLanguage = 'de-DE' | 'zh-CN';
export const SPEECH_ERROR_MESSAGE = 'Audio is unavailable on this device. Please try again.';

export function speechText(text: string, language: SpeechLanguage): string {
  if (language === 'de-DE') return text.split(' — ')[0].trim();

  return text.match(/[\u3400-\u9fff《》]+…?/g)?.join(' ') ?? text.trim();
}
