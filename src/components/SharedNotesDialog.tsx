import { useCallback, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StorageLike } from '../library/discLibrary';
import { appendNote, loadNotes, saveNotes } from '../library/notebook';
import type { SharedNotes } from '../model/noteShare';
import { BevelButton } from './BevelButton';
import type { NotebookDisc } from './NotebookDialog';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/notebook.css';

export interface SharedNotesDialogProps {
  shared: SharedNotes;
  /** Every mounted disc: the notebooks the shared notes can be saved into. */
  discs: readonly NotebookDisc[];
  /** The disc to save into when the shared one is not mounted: the open disc, or the last one used. */
  fallbackDiscId?: string;
  storage: StorageLike | undefined;
  onClose: () => void;
}

/**
 * Shows notes someone shared with a ?notes= link: the disc they came from and the text, read-only.
 * Save to My Notebook adds them to the end of a notebook here: the same disc's when it is mounted,
 * otherwise the open or chosen disc's. Nothing is saved until the button is pressed.
 */
export function SharedNotesDialog({ shared, discs, fallbackDiscId, storage, onClose }: SharedNotesDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const selectId = useId();
  const mounted = discs.some((d) => d.disc_id === shared.discId);
  const firstChoice = mounted
    ? shared.discId
    : (discs.find((d) => d.disc_id === fallbackDiscId) ?? discs[0])?.disc_id ?? '';
  const [target, setTarget] = useState(firstChoice);
  const [saved, setSaved] = useState<string | null>(null);
  const cancel = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, cancel, true);

  const targetTitle = discs.find((d) => d.disc_id === target)?.title ?? target;
  const canSave = storage !== undefined && target !== '';

  const save = () => {
    if (!canSave) return;
    const ok = saveNotes(storage, target, appendNote(loadNotes(storage, target), shared.text));
    setSaved(ok ? `Saved to the ${targetTitle} notebook.` : 'This browser could not save the notes.');
  };

  const host = document.querySelector('.desktop__work') ?? document.body;

  return createPortal(
    <div ref={layerRef} className="modal-layer">
      <Window title="Shared Notes" className="shared-notes-dialog notebook-dialog" modal onClose={cancel}>
        <div className="notebook-dialog__body">
          <p className="notebook-dialog__label">
            Notes from <cite>{shared.discTitle}</cite>
          </p>
          {!mounted ? (
            <p className="notebook-dialog__count">That disc is not mounted here. Choose a notebook to save the notes into.</p>
          ) : null}
          <textarea
            className="notebook-dialog__pad"
            aria-label="Shared notes"
            rows={10}
            readOnly
            spellCheck={false}
            value={shared.text}
          />
          <div className="notebook-dialog__top">
            <label htmlFor={selectId} className="notebook-dialog__label">
              Save into:
            </label>
            <select
              id={selectId}
              className="notebook-dialog__select"
              value={target}
              disabled={discs.length === 0 || saved !== null}
              onChange={(e) => setTarget(e.target.value)}
            >
              {discs.map((d) => (
                <option key={d.disc_id} value={d.disc_id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <div className="notebook-dialog__buttons">
            <span className="notebook-dialog__note" aria-live="polite">
              {saved ?? (discs.length === 0 ? 'No disc is mounted to save into.' : '')}
            </span>
            <BevelButton disabled={!canSave || saved !== null} onClick={save}>
              Save to My Notebook
            </BevelButton>
            <BevelButton onClick={cancel}>Close</BevelButton>
          </div>
        </div>
      </Window>
    </div>,
    host,
  );
}
