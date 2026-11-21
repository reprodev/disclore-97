import { MenuBar } from './MenuBar';
import { Window } from './Window';
import '../styles/shortcuts.css';

export const README_TEXT = `DiscLore '97 - ReadMe

DiscLore '97 is a make-believe 1997 CD-ROM encyclopedia. Every article, picture and sound on these discs is original. It is an unaffiliated tribute to the multimedia reference discs of the 1990s.

GETTING STARTED
- Open a disc from the desktop or from the Select a CD-ROM window.
- Pick a topic in the Contents list, or type in Find in Disc.
- Click the numbered pins on a diagram to jump to articles.
- Use Back, Forward and Home on the toolbar to move around.

KEEPMAZE
KeepMaze is a trivia dungeon. Choose an exit, answer a question about the disc to unlock the door, and make your way to the throne room. A wrong answer keeps the door locked and points you to the article that has the answer. Every dungeon is checked so that the throne room can always be reached.

SOUND
All sound effects are generated live, and no audio files are used. Use the Sound button in the taskbar to mute everything.
`;

export interface NotepadWindowProps {
  onClose: () => void;
  /** When provided, the title bar has a Minimize button. */
  onMinimize?: () => void;
  /** Hides the window while keeping it open (its taskbar tab stays). */
  minimized?: boolean;
}

/** A small Notepad-style About dialog. Draggable, closable, and minimizable to the taskbar. */
export function NotepadWindow({ onClose, onMinimize, minimized }: NotepadWindowProps) {
  return (
    <Window
      title="ReadMe.txt - Notepad"
      className="notepad-window"
      onClose={onClose}
      onMinimize={onMinimize}
      minimized={minimized}
      draggable
      menuBar={<MenuBar menus={[{ label: 'File', items: [{ label: 'Exit', onSelect: onClose }] }]} />}
    >
      <textarea
        className="notepad-window__text"
        aria-label="ReadMe.txt contents"
        readOnly
        spellCheck={false}
        defaultValue={README_TEXT}
      />
    </Window>
  );
}
