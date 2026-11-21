import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { burn, burnFallback } from '../adapters/burn';
import type { BurnResult } from '../adapters/burn';
import { ERROR_MESSAGES } from '../adapters/errors';
import type { BurnError, FetchLike } from '../adapters/types';
import type { DiscManifest } from '../model/manifest';
import { parseInput } from '../model/sourceInput';
import { BevelButton } from './BevelButton';
import { BurnProgress } from './BurnProgress';
import { PresetList } from './PresetList';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/burn.css';

export interface BurnDialogProps {
  onBurned: (m: DiscManifest) => void;
  onClose: () => void;
  fetch?: FetchLike;
  /** Minimum time a successful burn stays in the progress state. Default 800. */
  minBurnMs?: number;
  /** Reports whether the browser is online. Default `navigator.onLine !== false`. */
  online?: () => boolean;
}

const OFFLINE_NOTICE = 'URL sources need a connection.';

const defaultOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done);
  });
}

/** Modal "Burn New CD-R Disc..." dialog: turns pasted input into a disc via `burn`. */
export function BurnDialog({ onBurned, onClose, fetch: fetchImpl, minBurnMs = 800, online = defaultOnline }: BurnDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BurnError | null>(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    onClose();
  }, [onClose]);

  useModalDialog(layerRef, cancel, true);

  // A pending request must not call onBurned after the dialog is gone.
  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const offline = !online();

  const run = async (task: (signal: AbortSignal) => Promise<BurnResult>) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    setBusy(true);
    setError(null);
    const started = Date.now();
    let result: BurnResult;
    try {
      result = await task(signal);
    } catch {
      result = { ok: false, error: { code: 'fetch-failed', message: ERROR_MESSAGES['fetch-failed'] } };
    }
    if (result.ok) await wait(minBurnMs - (Date.now() - started), signal);
    if (signal.aborted) return;
    controllerRef.current = null;
    setBusy(false);
    if (result.ok) {
      onBurned(result.manifest);
      return;
    }
    setError(result.error);
    // The textarea is re-enabled on the next render, so focus after it commits.
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onBurn = () => {
    if (busy || text.trim() === '') return;
    if (offline) {
      const parsed = parseInput(text);
      if (parsed.ok && (parsed.kind === 'github' || parsed.kind === 'webpage')) {
        setError({ code: 'network', message: OFFLINE_NOTICE });
        return;
      }
    }
    const input = text;
    void run((signal) => burn(input, { ...(fetchImpl ? { fetch: fetchImpl } : {}), signal }));
  };

  const onBurnOffline = (topic: string) => {
    if (busy) return;
    void run((signal) => burnFallback(topic, { signal }));
  };

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setError(null);
  };

  const onPreset = (value: string) => {
    setText(value);
    setError(null);
    inputRef.current?.focus();
  };

  const isOfflineNotice = error?.message === OFFLINE_NOTICE;
  const fallbackTopic = !isOfflineNotice && error?.fallbackTopic ? error.fallbackTopic : undefined;
  const offlineTopic = isOfflineNotice ? fallbackTopicFor(text) : fallbackTopic;
  const message = error ? (isOfflineNotice ? OFFLINE_NOTICE : ERROR_MESSAGES[error.code]) : '';

  return (
    <div ref={layerRef} className="modal-layer">
      <Window title="Burn New CD-R Disc..." className="burn-dialog" modal onClose={cancel}>
        <div className="burn-dialog__body">
          <label htmlFor="burn-input">Paste a GitHub address, a web page address, some Markdown, or a topic:</label>
          <textarea
            id="burn-input"
            ref={inputRef}
            className="burn-input"
            rows={5}
            value={text}
            disabled={busy}
            onChange={onChange}
          />
          <PresetList onSelect={onPreset} disabled={busy} />
          {offline && !error ? <p role="status">{OFFLINE_NOTICE}</p> : null}
          {busy ? <BurnProgress /> : null}
          <div role="alert" className="burn-error" hidden={!error}>
            {error ? (
              <>
                <p>{message}</p>
                {error.code === 'validation-failed' && error.validation && error.validation.length > 0 ? (
                  <ul>
                    {error.validation.map((v, i) => (
                      <li key={`${v.path}-${i}`}>
                        {v.path}: {v.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {offlineTopic ? (
                  <BevelButton disabled={busy} onClick={() => onBurnOffline(offlineTopic)}>
                    {`Burn offline from "${offlineTopic}"`}
                  </BevelButton>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="burn-dialog__buttons">
            <BevelButton disabled={busy || text.trim() === ''} onClick={onBurn}>
              Burn
            </BevelButton>
            <BevelButton onClick={cancel}>Cancel</BevelButton>
          </div>
        </div>
      </Window>
    </div>
  );
}

/** Repository name or page host for a URL input, used as the offline topic. */
function fallbackTopicFor(input: string): string | undefined {
  const parsed = parseInput(input);
  if (!parsed.ok) return undefined;
  if (parsed.kind === 'github') return parsed.repo;
  if (parsed.kind === 'webpage') {
    try {
      return new URL(parsed.url).hostname || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
