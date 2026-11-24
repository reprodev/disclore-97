import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchDefinition } from '../adapters/define';
import type { Definition } from '../adapters/define';
import type { FetchLike } from '../adapters/types';
import type { DiscManifest } from '../model/manifest';
import { findMentions } from '../model/discSearch';
import { editorialNote } from '../model/easterEggs';
import { BevelButton } from './BevelButton';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/dictionary.css';
import '../styles/eastereggs.css';

export interface DictionaryDialogProps {
  /** Every mounted disc. Matches are searched offline across all of them. */
  discs: readonly DiscManifest[];
  /** Word to look up on open. */
  initialWord?: string;
  onClose: () => void;
  /** Opens a matching article. The dialog closes itself afterwards. */
  onOpenSection: (discId: string, sectionId: string) => void;
  fetch?: FetchLike;
}

type Online =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'found'; value: Definition }
  | { state: 'missing' }
  | { state: 'offline' }
  | { state: 'bad' };

const WORD = /^\p{L}[\p{L}'’-]{0,39}$/u;
const KIND_LABEL = { title: 'Title', fact: 'Quick Fact', sentence: 'Text' } as const;

/**
 * Modal Dictionary: matches in every mounted disc appear instantly while typing. A short
 * definition is fetched from /api/define when the user presses Look Up (or Enter).
 */
export function DictionaryDialog({ discs, initialWord = '', onClose, onOpenSection, fetch }: DictionaryDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [word, setWord] = useState(initialWord.trim());
  const [online, setOnline] = useState<Online>({ state: 'idle' });

  const cancel = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, cancel, true);

  const mentions = useMemo(() => findMentions(discs, word), [discs, word]);
  // Easter egg: a few words carry a note from the 1997 editors. Plain data, so it shows offline too.
  const editorial = editorialNote(word);

  const lookUp = useCallback(
    async (raw: string) => {
      abortRef.current?.abort();
      const w = raw.trim();
      if (w === '') {
        setOnline({ state: 'idle' });
        return;
      }
      if (!WORD.test(w)) {
        setOnline({ state: 'bad' });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setOnline({ state: 'offline' });
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setOnline({ state: 'loading' });
      const res = await fetchDefinition(w, { fetch, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (res.ok) setOnline({ state: 'found', value: res.value });
      else setOnline({ state: res.error.code === 'unavailable' ? 'missing' : 'offline' });
    },
    [fetch],
  );

  useEffect(() => {
    if (initialWord.trim() !== '') void lookUp(initialWord);
    return () => abortRef.current?.abort();
    // Runs once for the word the dialog was opened with.
  }, []);

  const host = document.querySelector('.desktop__work') ?? document.body;
  const note = noteFor(online, mentions.length);

  return createPortal(
    <div ref={layerRef} className="modal-layer">
      <Window title="Dictionary" className="dictionary-dialog" modal onClose={cancel}>
        <form
          className="dictionary-dialog__body"
          onSubmit={(e) => {
            e.preventDefault();
            void lookUp(word);
          }}
        >
          <label htmlFor="dictionary-word" className="dictionary-dialog__label">
            Word
          </label>
          <div className="dictionary-dialog__row">
            <input
              id="dictionary-word"
              className="dictionary-dialog__input"
              type="text"
              value={word}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setWord(e.target.value);
                abortRef.current?.abort();
                setOnline({ state: 'idle' });
              }}
            />
            <BevelButton type="submit" disabled={word.trim() === ''}>
              Look Up
            </BevelButton>
          </div>

          <section className="dictionary-dialog__entry" aria-label="Definition">
            {online.state === 'found' ? (
              <div className="dictionary-dialog__def">
                <p className="dictionary-dialog__headword">
                  {online.value.word}
                  {online.value.phonetic ? <span className="dictionary-dialog__phonetic"> {online.value.phonetic}</span> : null}
                </p>
                {online.value.meanings.map((m, i) => (
                  <div key={i}>
                    <p className="dictionary-dialog__pos">{m.partOfSpeech}</p>
                    <ol className="dictionary-dialog__defs">
                      {m.definitions.map((d, j) => (
                        <li key={j}>{d}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="dictionary-dialog__note" aria-live="polite">
              {note}
            </p>
          </section>

          {editorial ? (
            <section className="dictionary-dialog__editorial" aria-label="Editorial Note (1997)">
              <h2 className="dictionary-dialog__editorial-title">Editorial Note (1997)</h2>
              <p className="dictionary-dialog__editorial-text">
                <strong>{editorial.headword}</strong> {editorial.note}
              </p>
            </section>
          ) : null}

          <section className="dictionary-dialog__matches" aria-label="In your discs">
            <h2 className="dictionary-dialog__heading">In your discs</h2>
            {mentions.length === 0 ? (
              <p className="dictionary-dialog__none">
                {word.trim().length < 2 ? 'Type a word to search every mounted disc.' : 'No matches on the mounted discs.'}
              </p>
            ) : (
              <ul className="dictionary-dialog__list">
                {mentions.map((m, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="dictionary-dialog__hit"
                      onClick={() => {
                        onOpenSection(m.discId, m.sectionId);
                        onClose();
                      }}
                    >
                      <span className="dictionary-dialog__where">
                        {m.discTitle} &rsaquo; {m.sectionTitle} &bull; {KIND_LABEL[m.kind]}
                      </span>
                      <span className="dictionary-dialog__text">{m.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="dictionary-dialog__buttons">
            <BevelButton onClick={cancel}>Close</BevelButton>
          </div>
        </form>
      </Window>
    </div>,
    host,
  );
}

function noteFor(online: Online, matches: number): string {
  switch (online.state) {
    case 'loading':
      return 'Looking up the definition...';
    case 'found':
      return '';
    case 'missing':
      return matches > 0
        ? 'No dictionary entry was found. Showing matches from your discs.'
        : 'No dictionary entry was found.';
    case 'offline':
      return matches > 0
        ? 'The dictionary is not reachable. Showing matches from your discs.'
        : 'The dictionary is not reachable.';
    case 'bad':
      return 'Look Up needs a single word.';
    default:
      return '';
  }
}
