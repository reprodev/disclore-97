import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveTextFile } from '../library/discImage';
import type { StorageLike } from '../library/discLibrary';
import { loadNotes, MAX_NOTE_CHARS, notesFileName, notesMarkdown, saveNotes } from '../library/notebook';
import { MAX_SHARE_NOTES, notesQuery } from '../model/noteShare';
import { BevelButton } from './BevelButton';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/notebook.css';
import '../styles/print.css';

export interface NotebookDisc {
  disc_id: string;
  title: string;
}

export interface NotebookDialogProps {
  /** Every mounted disc. The selector switches between their notebooks. */
  discs: readonly NotebookDisc[];
  /** The disc whose notes open first. */
  discId: string;
  storage: StorageLike | undefined;
  /** Disc ids whose notes are pinned to the desktop. With onTogglePin, shows the Pin to Desktop button. */
  pinned?: readonly string[];
  onTogglePin?: (discId: string) => void;
  /** The page address a share link starts from. Defaults to the current page without its query. */
  shareBase?: string;
  onClose: () => void;
}

/** Number of lines in the text: 0 for an empty pad. */
export function lineCount(text: string): number {
  return text === '' ? 0 : text.split('\n').length;
}

const currentPage = () => (typeof window === 'undefined' ? '' : window.location.href.split(/[?#]/)[0]!);

/**
 * Research Notebook: an editable ivory study pad for each mounted disc. Every edit is saved at once
 * under disclore97.notes.<disc_id>. The selector switches discs without closing the dialog. Clear
 * empties the pad, Export saves it as .txt or .md, Print prints a clean notes page, Copy Share Link
 * copies a ?notes= link, and Pin to Desktop puts a Notes.txt shortcut on the desktop.
 */
export function NotebookDialog({ discs, discId: initialDiscId, storage, pinned = [], onTogglePin, shareBase, onClose }: NotebookDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const shareInputRef = useRef<HTMLInputElement | null>(null);
  const selectId = useId();
  const [discId, setDiscId] = useState(initialDiscId);
  const [text, setText] = useState(() => loadNotes(storage, initialDiscId));
  const [notice, setNotice] = useState('');
  /** A share link the clipboard refused, shown for copying by hand. */
  const [manualLink, setManualLink] = useState<string | null>(null);
  const cancel = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, cancel, true);

  const disc = discs.find((d) => d.disc_id === discId) ?? { disc_id: discId, title: discId };
  const isPinned = pinned.includes(discId);

  // While the notebook is open, the print rules show only its notes page.
  useEffect(() => {
    document.body.classList.add('notes-printing');
    return () => document.body.classList.remove('notes-printing');
  }, []);

  // Select the fallback link so Ctrl+C copies it at once.
  useEffect(() => {
    if (manualLink !== null) shareInputRef.current?.select();
  }, [manualLink]);

  const switchTo = (id: string) => {
    setDiscId(id);
    setText(loadNotes(storage, id));
    setNotice('');
    setManualLink(null);
  };

  const edit = (next: string) => {
    const clipped = next.slice(0, MAX_NOTE_CHARS);
    setText(clipped);
    setNotice('');
    setManualLink(null);
    saveNotes(storage, discId, clipped);
  };

  const exportAs = (ext: 'txt' | 'md') => {
    const ok =
      ext === 'md'
        ? saveTextFile(notesFileName(discId, 'md'), notesMarkdown(disc.title, text), 'text/markdown')
        : saveTextFile(notesFileName(discId), text, 'text/plain');
    setNotice(ok ? `Notebook exported (.${ext}).` : 'This browser could not save the file.');
  };

  const print = () => window.print();

  const copyShareLink = async () => {
    const link = (shareBase ?? currentPage()) + notesQuery({ discId, discTitle: disc.title, text });
    const cut = text.length > MAX_SHARE_NOTES ? ` Only the first ${MAX_SHARE_NOTES} characters are in the link.` : '';
    try {
      await navigator.clipboard.writeText(link);
      setManualLink(null);
      setNotice(`Share link copied.${cut}`);
    } catch {
      setManualLink(link);
      setNotice(cut.trim());
    }
  };

  const host = document.querySelector('.desktop__work') ?? document.body;
  const chars = text.length;
  const lines = lineCount(text);
  const empty = text === '';

  return createPortal(
    <div ref={layerRef} className="modal-layer">
      <Window title={`Research Notebook \u2014 ${disc.title}`} className="notebook-dialog" modal onClose={cancel}>
        <div className="notebook-dialog__body">
          <div className="notebook-dialog__top">
            <label htmlFor={selectId} className="notebook-dialog__label">
              Disc:
            </label>
            <select id={selectId} className="notebook-dialog__select" value={discId} onChange={(e) => switchTo(e.target.value)}>
              {discs.map((d) => (
                <option key={d.disc_id} value={d.disc_id}>
                  {d.title}
                </option>
              ))}
            </select>
            {onTogglePin ? (
              <BevelButton className="article-tools__toggle" aria-pressed={isPinned} onClick={() => onTogglePin(discId)}>
                {isPinned ? 'Pinned to Desktop' : 'Pin to Desktop'}
              </BevelButton>
            ) : null}
          </div>
          <label htmlFor="notebook-pad" className="notebook-dialog__label">
            Study pad
          </label>
          <textarea
            id="notebook-pad"
            className="notebook-dialog__pad"
            rows={12}
            spellCheck={false}
            value={text}
            placeholder="Type notes here, or use + Note beside a Quick Fact, or + Quote in an article."
            onChange={(e) => edit(e.target.value)}
          />
          <p className="notebook-dialog__count">
            {chars} {chars === 1 ? 'character' : 'characters'}, {lines} {lines === 1 ? 'line' : 'lines'}
          </p>
          {manualLink !== null ? (
            <fieldset className="groupbox notebook-dialog__share" role="group" aria-label="Share Link">
              <legend className="groupbox__legend">Share Link</legend>
              <p className="notebook-dialog__share-text">The clipboard is not available. Copy this link by hand:</p>
              <input
                ref={shareInputRef}
                className="notebook-dialog__share-link"
                type="text"
                readOnly
                aria-label="Share link"
                value={manualLink}
                onFocus={(e) => e.target.select()}
              />
            </fieldset>
          ) : null}
          <div className="notebook-dialog__buttons">
            <span className="notebook-dialog__note" aria-live="polite">
              {notice}
            </span>
            <BevelButton disabled={empty} onClick={() => edit('')}>
              Clear
            </BevelButton>
            <BevelButton disabled={empty} onClick={() => exportAs('txt')}>
              Export (.txt)
            </BevelButton>
            <BevelButton disabled={empty} onClick={() => exportAs('md')}>
              Export (.md)
            </BevelButton>
            <BevelButton disabled={empty} onClick={print}>
              Print...
            </BevelButton>
            <BevelButton disabled={empty} onClick={() => void copyShareLink()}>
              Copy Share Link
            </BevelButton>
            <BevelButton onClick={cancel}>Close</BevelButton>
          </div>
          {/* The printed page: hidden on screen, shown alone by the print rules. */}
          <div className="notebook-dialog__page" aria-hidden="true">
            <p className="notebook-dialog__running">DiscLore &apos;97 &bull; Research Notebook</p>
            <h2 className="notebook-dialog__heading">{disc.title} &mdash; Research Notes</h2>
            <pre className="notebook-dialog__print-text">{text}</pre>
          </div>
        </div>
      </Window>
    </div>,
    host,
  );
}
