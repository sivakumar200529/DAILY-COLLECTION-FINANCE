import { useCallback, useEffect, useRef, useState } from 'react';

export type SpeechLanguage = 'en-IN' | 'ta-IN';
export type SpeechProblem = 'blocked' | 'no-speech' | 'failed';

/** Voice typing through the browser's own speech service (Chrome, Edge and Safari have one). */
export function useSpeech() {
  const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const active = useRef<any>(null);
  const [listeningTo, setListeningTo] = useState<string | null>(null);
  const [problem, setProblem] = useState<SpeechProblem | null>(null);

  const stop = useCallback(() => {
    active.current?.stop();
  }, []);

  /** Starts listening; `key` says which button is listening. Tapping the same button again stops it. */
  const listen = useCallback(
    (key: string, language: SpeechLanguage, onText: (text: string) => void) => {
      if (active.current) {
        const same = listeningTo === key;
        active.current.onend = null;
        active.current.stop();
        active.current = null;
        setListeningTo(null);
        if (same) return;
      }
      setProblem(null);
      const recognition = new Recognition();
      recognition.lang = language;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event: any) => {
        const text = Array.from(event.results as ArrayLike<any>).map(r => r[0].transcript).join(' ').trim();
        if (text) onText(text);
      };
      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setProblem('blocked');
        else if (event.error === 'no-speech') setProblem('no-speech');
        else if (event.error !== 'aborted') setProblem('failed');
      };
      recognition.onend = () => {
        active.current = null;
        setListeningTo(null);
      };
      active.current = recognition;
      setListeningTo(key);
      recognition.start();
    },
    [Recognition, listeningTo]
  );

  useEffect(() => () => {
    if (active.current) {
      active.current.onend = null;
      active.current.abort();
    }
  }, []);

  return { supported: !!Recognition, listeningTo, problem, listen, stop };
}
