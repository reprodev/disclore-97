import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playEject, playLinerChime } from '../audio/audio';
import { EJECT_MESSAGE, LINER_NOTES, LINER_NOTES_HINTS, LINER_NOTES_TITLE } from '../model/easterEggs';
import { BevelButton } from './BevelButton';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/eastereggs.css';

export interface LinerNotesDialogProps {
  onClose: () => void;
  /** Called when Eject Disc is pressed, so the taskbar can pulse its Drive D: light. */
  onEject?: () => void;
}

/** The hidden Drive D:\LINER_NOTES.TXT window, opened by clicking the Drive D: light five times. */
export function LinerNotesDialog({ onClose, onEject }: LinerNotesDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [ejected, setEjected] = useState(false);
  const cancel = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, cancel, true);

  useEffect(() => {
    playLinerChime();
  }, []);

  const eject = () => {
    playEject();
    setEjected(true);
    onEject?.();
  };

  const host = (typeof document !== 'undefined' && document.querySelector('.desktop__work')) || document.body;
  return createPortal(
    <div ref={layerRef} className="modal-layer">
      <Window title={LINER_NOTES_TITLE} className="liner-notes" modal onClose={cancel}>
        <div className="liner-notes__body">
          <div className="liner-notes__page">
            {LINER_NOTES.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p className="liner-notes__rule" aria-hidden="true">
              ----------------------------------------
            </p>
            <p>P.S. A few things on this disc are hidden on purpose:</p>
            <ul className="liner-notes__hints" aria-label="Hints">
              {LINER_NOTES_HINTS.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
          <p className="liner-notes__eject" aria-live="polite">
            {ejected ? EJECT_MESSAGE : ''}
          </p>
          <div className="liner-notes__buttons">
            <BevelButton onClick={eject}>Eject Disc</BevelButton>
            <BevelButton onClick={cancel}>Close</BevelButton>
          </div>
        </div>
      </Window>
    </div>,
    host,
  );
}
