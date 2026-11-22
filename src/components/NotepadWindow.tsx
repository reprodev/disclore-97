import { MenuBar } from './MenuBar';
import { Window } from './Window';
import '../styles/shortcuts.css';

export const README_TEXT = `DiscLore '97 - ReadMe

DiscLore '97 is a make-believe 1997 CD-ROM encyclopedia. The two built-in discs are completely original, and the app is an unaffiliated tribute to the multimedia reference discs of the 1990s.

DISCS
- Two pre-baked Expansion Packs ship with the app: Ancient Castles and Keeps, and Retro Computing and the Dial-Up Era.
- Open a disc from the desktop, the Start menu, or the Select a CD-ROM window. Pick a topic in the Contents list, or type in Find in Disc.
- Use Back, Forward and Home on the toolbar to move around.

BURN NEW CD-R DISC
Compile your own disc from:
- A public GitHub repository (read through the GitHub API).
- A web page address (the text and pictures are read by a small server function).
- A topic. The topic is looked up on English Wikipedia and built into a disc with its text and pictures. If you are offline, or nothing matches, you get an offline study outline instead, and it says so.
- Markdown text that you paste in.
Burned discs are checked by the same safety checks as the built-in ones, then kept in this browser (up to 10 discs). They never leave your device.

READING
- Chronology strip: dated entries for the article, laid out along a timeline.
- Show in Diagram: jumps to the diagram and highlights the pin for the article you were reading.
- Cite / Print Preview: shows a page-style preview and a Copy Citation button.
- Read Aloud: your browser's own voice reads the article, one paragraph at a time. The button shows how far it has got, for example Stop (2/5). Use Stop or the Sound button to silence it.

PICTURES
- When a disc has pictures, the Multimedia Reel shows them in a picture frame. Prev, Play and Next step through them every four seconds.
- Click a picture, or press Enlarge, to open the Picture Viewer. Arrow Left and Arrow Right change picture, Space starts and pauses the show, the thumbnail strip jumps to a picture, and Escape closes the window.
- A picture that cannot be loaded is replaced by an illustration plate.

DIAGRAMS
Click the numbered pins on a diagram to jump to articles. Burned discs get a diagram that matches their source: a blueprint for a GitHub repository, a site map for a web page, an outline for Markdown, and a concept chart for a topic.

KEEPMAZE
KeepMaze is a trivia dungeon. Choose an exit, answer a question about the disc to unlock the door, and make your way to the throne room. The Quest card shows your goal and how many rooms you have explored, and the mini-map legend explains its colours. Peek Hint shows the first sentence of the article that holds the answer. A wrong answer keeps the door locked and points you to that article. Every dungeon is checked with a breadth-first search, so the throne room can always be reached. Reach it to earn a Victory Certificate.

SOUND
All sound effects are generated live, and no audio files are used. Use the Sound button in the taskbar to mute everything, including Read Aloud.

ATTRIBUTION AND LICENSING
- Built-in discs: original text, artwork and sound, made for this project.
- Topic discs: article text comes from English Wikipedia and is available under the Creative Commons Attribution-ShareAlike 4.0 license (CC BY-SA 4.0). Pictures come from Wikimedia Commons and keep their own media licenses, which differ from file to file. The Wikipedia page that a disc was built from is named in the Source line at the end of the first section.
- Web page and GitHub discs: the text and pictures belong to their authors. The Source line in the first section names where they came from. Check the original for its license before you reuse anything.
- Wikipedia and Wikimedia Commons are projects of the Wikimedia Foundation. DiscLore '97 is not affiliated with or endorsed by the Wikimedia Foundation, GitHub, or any other source.
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
