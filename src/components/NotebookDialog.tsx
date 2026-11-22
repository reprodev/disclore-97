import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { saveTextFile } from '../library/discImage';
import type { StorageLike } from '../library/discLibrary';
import { loadNotes, MAX_NOTE_CHARS, notesFileName, saveNotes } from '../library/notebook';
import { BevelButton } from './BevelButton';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/notebook.css';

export interface NotebookDialogProps {
  discId: string;
  discTitle: string;
  storage: StorageLike | undefined;
  onClose: () => void;
}

/** Number of lines in the text: 0 for an empty pad. */
export function lineCount(text: string): number {
  return text === '' ? 0 : text.split('\n').length;
}

/**
 * Research Notebook: an editable ivory study pad for one disc. Every edit is saved at once under
 * disclore97.notes.<disc_id>. Clear empties the pad, and Export (.txt) saves it as a text file.
 */
export function NotebookDialog({ discId, discTitle, storage, onClose }: NotebookDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [text, setText] = useState(() => loadNotes(storage, discId));
  const [notice, setNotice] = useState('');
  const cancel = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, cancel, true);

  const edit = (next: string) => {
    const clipped = next.slice(0, MAX_NOTE_CHARS);
    setText(clipped);
    setNotice('');
    saveNotes(storage, discId, clipped);
  };

  const exportText = () => {
    const ok = saveTextFile(notesFileName(discId), text, 'text/plain');
    setNotice(ok ? 'Notebook exported.' : 'This browser could not save the file.');
  };

  const host = document.querySelector('.desktop__work') ?? document.body;
  const chars = text.length;
  const lines = lineCount(text);

  return createPortal(
    <div ref={layerRef} className="modal-layer">
      <Window title={`Research Notebook \u2014 ${discTitle}`} className="notebook-dialog" modal onClose={cancel}>
        <div className="notebook-dialog__body">
          <label htmlFor="notebook-pad" className="notebook-dialog__label">
            Study pad
          </label>
          <textarea
            id="notebook-pad"
            className="notebook-dialog__pad"
            rows={12}
            spellCheck={false}
            value={text}
            placeholder="Type notes here, or use + Note beside a Quick Fact."
            onChange={(e) => edit(e.target.value)}
          />
          <p className="notebook-dialog__count">
            {chars} {chars === 1 ? 'character' : 'characters'}, {lines} {lines === 1 ? 'line' : 'lines'}
          </p>
          <div className="notebook-dialog__buttons">
            <span className="notebook-dialog__note" aria-live="polite">
              {notice}
            </span>
            <BevelButton disabled={text === ''} onClick={() => edit('')}>
              Clear
            </BevelButton>
            <BevelButton disabled={text === ''} onClick={exportText}>
              Export (.txt)
            </BevelButton>
            <BevelButton onClick={cancel}>Close</BevelButton>
          </div>
        </div>
      </Window>
    </div>,
    host,
  );
}
