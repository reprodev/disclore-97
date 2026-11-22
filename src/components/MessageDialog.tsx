import { useRef } from 'react';
import { BevelButton } from './BevelButton';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/browser.css';

export interface MessageDialogProps {
  title: string;
  message: string;
  /** Optional list of details, one line each. */
  details?: readonly string[];
  /** Extra line shown after the details, for example "and 3 more". */
  footnote?: string;
  onClose: () => void;
}

/** A small modal Win95 message box with an OK button. Escape and OK close it. */
export function MessageDialog({ title, message, details = [], footnote, onClose }: MessageDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  useModalDialog(layerRef, onClose, true);

  return (
    <div ref={layerRef} className="modal-layer">
      <Window title={title} className="message-dialog" modal onClose={onClose}>
        <div className="message-dialog__body">
          <p role="alert" className="message-dialog__message">
            {message}
          </p>
          {details.length > 0 ? (
            <ul className="message-dialog__details" aria-label="Details">
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          ) : null}
          {footnote ? <p className="message-dialog__footnote">{footnote}</p> : null}
          <div className="message-dialog__buttons">
            <BevelButton onClick={onClose}>OK</BevelButton>
          </div>
        </div>
      </Window>
    </div>
  );
}
