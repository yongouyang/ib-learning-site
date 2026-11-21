'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { SPEECH_ERROR_MESSAGE, speechText, type SpeechLanguage } from '@/lib/speech';

interface SpeechButtonProps {
  text: string;
  language: SpeechLanguage;
  className?: string;
  errorDisplay?: 'inline' | 'external';
  onPlaybackStart?: () => void;
  onPlaybackError?: () => void;
}

const subscribe = () => () => {};
const browserSupportsSpeech = () => typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
const serverSupportsSpeech = () => false;

export default function SpeechButton({
  text,
  language,
  className = '',
  errorDisplay = 'inline',
  onPlaybackStart,
  onPlaybackError,
}: SpeechButtonProps) {
  const supported = useSyncExternalStore(subscribe, browserSupportsSpeech, serverSupportsSpeech);
  const [speaking, setSpeaking] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const spokenText = speechText(text, language);

  useEffect(() => {
    return () => {
      if (utteranceRef.current) window.speechSynthesis?.cancel();
    };
  }, []);

  if (!supported || !spokenText) return null;

  const stop = () => {
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
    setPlaybackError(false);
  };

  const speak = () => {
    if (speaking) {
      stop();
      return;
    }

    const synthesis = window.speechSynthesis;
    setPlaybackError(false);
    onPlaybackStart?.();
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = language;
    utterance.rate = 0.9;
    const voice = synthesis.getVoices().find((candidate) => candidate.lang.replace('_', '-') === language);
    if (voice) utterance.voice = voice;
    const finish = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      setSpeaking(false);
    };
    utterance.onend = finish;
    utterance.onerror = (event) => {
      if (utteranceRef.current !== utterance) return;
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        if (errorDisplay === 'external') onPlaybackError?.();
        else setPlaybackError(true);
      }
      finish();
    };
    utteranceRef.current = utterance;
    setSpeaking(true);
    synthesis.speak(utterance);
  };

  const label = `${speaking ? 'Stop' : 'Listen to'} ${spokenText}`;

  return (
    <div className={`inline-flex shrink-0 flex-row-reverse items-start gap-1 ${className}`}>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={(event) => {
          event.stopPropagation();
          speak();
        }}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-blue-400"
      >
        {speaking ? <Square className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
      </button>
      {playbackError && (
        <p role="alert" className="w-48 rounded-lg border border-red-200 bg-white p-2 text-left text-xs text-red-600 shadow-sm dark:border-red-900 dark:bg-gray-900 dark:text-red-400">
          {SPEECH_ERROR_MESSAGE}
        </p>
      )}
    </div>
  );
}
