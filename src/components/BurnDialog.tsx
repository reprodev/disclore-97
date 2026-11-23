import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { burn, burnFallback, burnStitchedDisc } from '../adapters/burn';
import type { BurnResult } from '../adapters/burn';
import { ERROR_MESSAGES } from '../adapters/errors';
import type { BurnError, FetchLike } from '../adapters/types';
import type { DiscManifest } from '../model/manifest';
import { parseInput } from '../model/sourceInput';
import { MAX_STITCH, MIN_STITCH } from '../model/stitch';
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
  /** Text to start with in the box, for example a sample topic. */
  initialText?: string;
  /** Starts burning the initial text as soon as the dialog opens. */
  autoStart?: boolean;
}

const OFFLINE_NOTICE = 'URL sources need a connection.';

export type BurnMode = 'single' | 'stitch';

/** The one-click stitch preset: a GitHub repository and a Wikipedia topic on one disc. */
export const STITCH_PRESET = {
  label: 'Mix: octocat/Hello-World + Lighthouse',
  rows: ['https://github.com/octocat/Hello-World', 'Lighthouse'],
} as const;

const ROW_HINT = 'A topic, a GitHub or web page address, or Markdown';

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
export function BurnDialog({
  onBurned,
  onClose,
  fetch: fetchImpl,
  minBurnMs = 800,
  online = defaultOnline,
  initialText = '',
  autoStart = false,
}: BurnDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BurnError | null>(null);
  const [mode, setMode] = useState<BurnMode>('single');
  const [discTitle, setDiscTitle] = useState('');
  const [rows, setRows] = useState<string[]>(() => Array.from({ length: MIN_STITCH }, () => ''));
  const rowRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const filledRows = rows.filter((r) => r.trim() !== '');
  // The error focus runs after an await, so it reads the mode through a ref.
  const modeRef = useRef<BurnMode>(mode);
  modeRef.current = mode;

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
    setTimeout(() => (modeRef.current === 'stitch' ? rowRefs.current[0] : inputRef.current)?.focus(), 0);
  };

  const burnText = (input: string) => {
    if (busy || input.trim() === '') return;
    if (offline) {
      const parsed = parseInput(input);
      if (parsed.ok && (parsed.kind === 'github' || parsed.kind === 'webpage')) {
        setError({ code: 'network', message: OFFLINE_NOTICE });
        return;
      }
    }
    void run((signal) => burn(input, { ...(fetchImpl ? { fetch: fetchImpl } : {}), signal }));
  };

  const onBurn = () => burnText(text);

  // A sample burn starts by itself once, when the dialog opens.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    burnText(initialText);
  }, []);

  const onBurnOffline = (topic: string) => {
    if (busy) return;
    void run((signal) => burnFallback(topic, { signal }));
  };

  const switchMode = (next: BurnMode) => {
    if (busy || next === mode) return;
    setMode(next);
    setError(null);
  };

  const setRow = (i: number, value: string) => {
    setRows((rs) => rs.map((r, j) => (j === i ? value : r)));
    setError(null);
  };

  const addRow = () => {
    if (rows.length >= MAX_STITCH) return;
    setRows((rs) => [...rs, '']);
    setError(null);
    setTimeout(() => rowRefs.current[rows.length]?.focus(), 0);
  };

  const removeRow = (i: number) => {
    if (rows.length <= MIN_STITCH) return;
    setRows((rs) => rs.filter((_, j) => j !== i));
    setError(null);
  };

  const onStitchPreset = () => {
    setRows([...STITCH_PRESET.rows]);
    setError(null);
    rowRefs.current[0]?.focus();
  };

  const onStitch = () => {
    if (busy || filledRows.length < MIN_STITCH) return;
    if (offline) {
      const needsNetwork = filledRows.some((r) => {
        const parsed = parseInput(r);
        return parsed.ok && (parsed.kind === 'github' || parsed.kind === 'webpage');
      });
      if (needsNetwork) {
        setError({ code: 'network', message: OFFLINE_NOTICE });
        return;
      }
    }
    const title = discTitle.trim() === '' ? undefined : discTitle;
    void run((signal) => burnStitchedDisc(rows, title, { ...(fetchImpl ? { fetch: fetchImpl } : {}), signal }));
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
  // A stitched burn names the source that failed in its message, so Stitch mode shows the message itself.
  const message = error
    ? isOfflineNotice
      ? OFFLINE_NOTICE
      : mode === 'stitch'
        ? error.message
        : ERROR_MESSAGES[error.code]
    : '';
  const stitching = mode === 'stitch';

  return (
    <div ref={layerRef} className="modal-layer">
      <Window title="Burn New CD-R Disc..." className="burn-dialog" modal onClose={cancel}>
        <div className="burn-dialog__body">
          <fieldset className="burn-mode" disabled={busy}>
            <legend className="burn-mode__legend">Burn mode</legend>
            <label className="burn-mode__option">
              <input type="radio" name="burn-mode" checked={!stitching} onChange={() => switchMode('single')} />
              Single Source
            </label>
            <label className="burn-mode__option">
              <input type="radio" name="burn-mode" checked={stitching} onChange={() => switchMode('stitch')} />
              Stitch CD-R (2-4 Sources)
            </label>
          </fieldset>
          {stitching ? (
            <div className="burn-stitch" role="group" aria-label="Stitch sources">
              <label htmlFor="burn-stitch-title" className="burn-stitch__label">
                Disc Title (optional):
              </label>
              <input
                id="burn-stitch-title"
                className="burn-stitch__title"
                type="text"
                maxLength={80}
                placeholder="Leave blank to name it after its sources"
                value={discTitle}
                disabled={busy}
                onChange={(e) => setDiscTitle(e.target.value)}
              />
              <ol className="burn-stitch__rows">
                {rows.map((row, i) => (
                  <li key={i} className="burn-stitch__row">
                    <label htmlFor={`burn-stitch-${i}`} className="burn-stitch__label">
                      Source {i + 1}:
                    </label>
                    <textarea
                      id={`burn-stitch-${i}`}
                      ref={(el) => {
                        rowRefs.current[i] = el;
                      }}
                      className="burn-input burn-stitch__input"
                      rows={2}
                      placeholder={ROW_HINT}
                      value={row}
                      disabled={busy}
                      onChange={(e) => setRow(i, e.target.value)}
                    />
                    <BevelButton
                      className="burn-stitch__remove"
                      aria-label={`Remove Source ${i + 1}`}
                      disabled={busy || rows.length <= MIN_STITCH}
                      onClick={() => removeRow(i)}
                    >
                      Remove
                    </BevelButton>
                  </li>
                ))}
              </ol>
              <div className="burn-stitch__tools">
                <BevelButton disabled={busy || rows.length >= MAX_STITCH} onClick={addRow}>
                  + Add Source
                </BevelButton>
                <BevelButton disabled={busy} onClick={onStitchPreset}>
                  {STITCH_PRESET.label}
                </BevelButton>
                <span className="burn-stitch__count">
                  {rows.length} of {MAX_STITCH} sources
                </span>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
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
                {offlineTopic && !stitching ? (
                  <BevelButton disabled={busy} onClick={() => onBurnOffline(offlineTopic)}>
                    {`Burn offline from "${offlineTopic}"`}
                  </BevelButton>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="burn-dialog__buttons">
            {stitching ? (
              <BevelButton disabled={busy || filledRows.length < MIN_STITCH} onClick={onStitch}>
                Stitch &amp; Burn
              </BevelButton>
            ) : (
              <BevelButton disabled={busy || text.trim() === ''} onClick={onBurn}>
                Burn
              </BevelButton>
            )}
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
