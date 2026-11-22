import { useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BevelButton } from './BevelButton';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/dictionary.css';

export interface ShortcutGroup {
  title: string;
  rows: { keys: string; action: string }[];
}

/** Every keyboard shortcut the app answers to, grouped by where it works. */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'Reading',
    rows: [
      { keys: 'Ctrl+F / Cmd+F', action: 'Find in Article (opens and focuses the search bar)' },
      { keys: 'Enter / Shift+Enter', action: 'Next / previous match in the search bar' },
      { keys: 'Esc', action: 'Close the search bar' },
      { keys: 'Ctrl+D / Cmd+D', action: 'Open the Dictionary' },
    ],
  },
  {
    title: 'Picture Viewer',
    rows: [
      { keys: 'Space', action: 'Play or pause the slideshow' },
      { keys: '\u2190 / \u2192', action: 'Previous / next picture' },
      { keys: 'Esc', action: 'Close the viewer' },
    ],
  },
  {
    title: 'Pinpointer search',
    rows: [
      { keys: '\u2191 / \u2193', action: 'Move through the results' },
      { keys: 'Enter', action: 'Open the highlighted result' },
      { keys: 'Esc', action: 'Close the results' },
    ],
  },
  {
    title: 'Dialogs and menus',
    rows: [
      { keys: 'Tab / Shift+Tab', action: 'Move between controls inside a dialog' },
      { keys: 'Esc', action: 'Close the dialog or menu' },
    ],
  },
];

export interface ShortcutsDialogProps {
  onClose: () => void;
}

/** Compact Win95 "Keyboard Shortcuts" dialog opened from Help > Shortcuts... */
export function ShortcutsDialog({ onClose }: ShortcutsDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const cancel = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, cancel, true);
  const host = document.querySelector('.desktop__work') ?? document.body;

  return createPortal(
    <div ref={layerRef} className="modal-layer">
      <Window title="Keyboard Shortcuts" className="shortcuts-dialog" modal onClose={cancel}>
        <div className="shortcuts-dialog__body">
          {SHORTCUT_GROUPS.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <h2 className="shortcuts-dialog__heading">{g.title}</h2>
              <dl className="shortcuts-dialog__list">
                {g.rows.map((r) => (
                  <div key={r.keys + r.action} className="shortcuts-dialog__row">
                    <dt>
                      <kbd className="shortcuts-dialog__keys">{r.keys}</kbd>
                    </dt>
                    <dd>{r.action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <div className="shortcuts-dialog__buttons">
            <BevelButton onClick={cancel}>OK</BevelButton>
          </div>
        </div>
      </Window>
    </div>,
    host,
  );
}
