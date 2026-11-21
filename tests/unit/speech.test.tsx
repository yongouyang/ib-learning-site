import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SpeechButton from '@/components/SpeechButton';
import { speechText } from '@/lib/speech';
import { getSubject } from '@/content/registry';
import { getContentTopic } from '@/content/registry.content';

describe('speechText', () => {
  it('removes English translations from German examples', () => {
    expect(speechText('Ich heiße Max. — My name is Max.', 'de-DE')).toBe('Ich heiße Max.');
    expect(speechText('Ich heiße...', 'de-DE')).toBe('Ich heiße...');
  });

  it('keeps Chinese characters and removes Pinyin from mixed card formats', () => {
    expect(speechText('你好 nǐ hǎo', 'zh-CN')).toBe('你好');
    expect(speechText('数学 (shùxué)', 'zh-CN')).toBe('数学');
    expect(speechText('午饭 zǎofàn / 晚饭 wǎnfàn', 'zh-CN')).toBe('午饭 晚饭');
    expect(speechText('《茶经》 (Chájīng)', 'zh-CN')).toBe('《茶经》');
    expect(speechText('我要… wǒ yào…', 'zh-CN')).toBe('我要…');
  });

  it('produces character-only speech for every Mandarin flashcard', () => {
    for (const meta of getSubject('chinese')!.topics) {
      const topic = getContentTopic('chinese', meta.id)!;
      for (const card of topic.flashcards) {
        const text = speechText(card.term, 'zh-CN');
        expect(text, card.id).not.toBe('');
        expect(text, card.id).not.toMatch(/[A-Za-z\u00c0-\u024f]/);
      }
    }
  });
});

describe('SpeechButton', () => {
  let utterances: SpeechSynthesisUtterance[];
  let speak: ReturnType<typeof vi.fn>;
  let cancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    utterances = [];
    speak = vi.fn((utterance: SpeechSynthesisUtterance) => utterances.push(utterance));
    cancel = vi.fn();
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text: string;
      lang = '';
      rate = 1;
      voice: SpeechSynthesisVoice | null = null;
      onend: ((event: SpeechSynthesisEvent) => void) | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    });
    vi.stubGlobal('speechSynthesis', {
      cancel,
      speak,
      getVoices: () => [{ lang: 'de-DE' }, { lang: 'zh-CN' }],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('speaks cleaned text with the requested language and a slower learning rate', async () => {
    const user = userEvent.setup();
    render(<SpeechButton text="Ich heiße Max. — My name is Max." language="de-DE" />);

    await user.click(await screen.findByRole('button', { name: 'Listen to Ich heiße Max.' }));

    expect(speak).toHaveBeenCalledTimes(1);
    expect(utterances[0]).toMatchObject({ text: 'Ich heiße Max.', lang: 'de-DE', rate: 0.9 });
    expect(utterances[0].voice?.lang).toBe('de-DE');
    expect(screen.getByRole('button', { name: 'Stop Ich heiße Max.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Stop Ich heiße Max.' })).not.toHaveAttribute('aria-pressed');
  });

  it('stops an active utterance on a second click', async () => {
    const user = userEvent.setup();
    render(<SpeechButton text="Guten Tag" language="de-DE" />);

    await user.click(await screen.findByRole('button', { name: 'Listen to Guten Tag' }));
    await user.click(screen.getByRole('button', { name: 'Stop Guten Tag' }));

    expect(cancel).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Listen to Guten Tag' })).toBeVisible();
  });

  it('resets when playback ends and cancels active playback on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SpeechButton text="你好 nǐ hǎo" language="zh-CN" />);
    await user.click(await screen.findByRole('button', { name: 'Listen to 你好' }));

    act(() => utterances[0].onend?.({} as SpeechSynthesisEvent));
    expect(screen.getByRole('button', { name: 'Listen to 你好' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Listen to 你好' }));
    unmount();
    expect(cancel).toHaveBeenCalledTimes(3);
  });

  it('ignores a cancelled utterance ending after another button starts', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SpeechButton text="Guten Tag" language="de-DE" />
        <SpeechButton text="Tschüss" language="de-DE" />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: 'Listen to Guten Tag' }));
    await user.click(screen.getByRole('button', { name: 'Listen to Tschüss' }));
    act(() => utterances[0].onerror?.({} as SpeechSynthesisErrorEvent));

    expect(screen.getByRole('button', { name: 'Stop Tschüss' })).toBeVisible();
    expect(utterances).toHaveLength(2);
  });

  it('reports playback failures but treats cancellation as normal', async () => {
    const user = userEvent.setup();
    render(<SpeechButton text="Guten Tag" language="de-DE" />);
    await user.click(await screen.findByRole('button', { name: 'Listen to Guten Tag' }));

    act(() => utterances[0].onerror?.({ error: 'not-allowed' } as SpeechSynthesisErrorEvent));
    expect(screen.getByRole('alert')).toHaveTextContent('Audio is unavailable on this device. Please try again.');
    expect(screen.getByRole('button', { name: 'Listen to Guten Tag' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Listen to Guten Tag' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => utterances[1].onerror?.({ error: 'canceled' } as SpeechSynthesisErrorEvent));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can delegate playback errors to a surrounding layout', async () => {
    const user = userEvent.setup();
    const onPlaybackStart = vi.fn();
    const onPlaybackError = vi.fn();
    render(
      <SpeechButton
        text="Guten Tag"
        language="de-DE"
        errorDisplay="external"
        onPlaybackStart={onPlaybackStart}
        onPlaybackError={onPlaybackError}
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Listen to Guten Tag' }));
    act(() => utterances[0].onerror?.({ error: 'not-allowed' } as SpeechSynthesisErrorEvent));

    expect(onPlaybackStart).toHaveBeenCalledTimes(1);
    expect(onPlaybackError).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders no control when browser speech is unavailable', async () => {
    vi.stubGlobal('speechSynthesis', undefined);
    vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    const { container } = render(<SpeechButton text="Guten Tag" language="de-DE" />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
