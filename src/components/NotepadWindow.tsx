import { MenuBar } from './MenuBar';
import { Window } from './Window';
import '../styles/shortcuts.css';

export const README_TEXT = `DiscLore '97 - ReadMe

DiscLore '97 is a make-believe 1997 CD-ROM encyclopedia. The four built-in discs are completely original, and the app is an unaffiliated tribute to the multimedia reference discs of the 1990s.

DISCS
- Four pre-baked Expansion Packs ship with the app: Ancient Castles and Keeps; Retro Computing and the Dial-Up Era; Folklore, Samhain and Halloween; and Lost Formats and Digital Resurrection.
- The Home window is styled like a 1997 multimedia encyclopedia: a DISCLORE 97 masthead on warm parchment, with faint engraved line art (a ringed planet, an open book, an arch and keep, and orbiting CD rings) behind it. The right-hand column lists Quick Jump Modes and Utilities as plain rows, each with an icon, a title, and a short italic note. A row pops up with a raised button edge when you point at it.
- The Pinpointer searches every disc. Type two or more letters to see matching articles, with the disc and where it came from. The last row of the list always reads Burn CD-R for your words (Wikipedia)..., so a search with no matches can become a new disc: press Enter on it, or click it, and the burn starts at once.
- Home also has a Did You Know? box and Surprise Me!. If you have not burned any discs yet, the Burned CD-Rs tab offers three sample burns: Halloween, Gothic fiction, and CD-ROM.
- Open a disc from the desktop, the Start menu, or the Select a CD-ROM window. Pick a topic in the Contents list, or type in Find in Disc.
- Use Back, Forward and Home on the toolbar to move around.

BURN NEW CD-R DISC
Compile your own disc from:
- A public GitHub repository (read through the GitHub API).
- A web page address (the text and pictures are read by a small server function).
- A topic. The topic is looked up on English Wikipedia and built into a disc with its text and pictures. If you are offline, or nothing matches, you get an offline study outline instead, and it says so.
- Markdown text that you paste in.
Burned discs are checked by the same safety checks as the built-in ones, then kept in this browser (up to 10 discs). They never leave your device unless you save one.

DISC IMAGES
- File > Save Disc Image (.json) writes the open disc to a file on your computer.
- File > Mount Disc Image (.json)..., or the Mount Disc Image card on the Home window, opens a saved file. It runs the same safety checks as a burned disc. If the file is not valid JSON, is not a disc, or holds anything unsafe (for example a picture that is not a public secure image address), a message box says why and nothing is mounted. A valid disc opens and is added to the library.

READING
- Chronology strip: dated entries for the article, laid out along a timeline.
- Explore History: the Timeline button on the toolbar gathers every dated event from every article on the open disc into one strip, oldest first, in columns by century. Each event shows the article it came from. Click an event to open that article, and use Back to return to the timeline. The button is dimmed when no article on the disc has dated events.
- Cross-links: when an article mentions the title of another article on the same disc, the words are a link. Each article is linked once per paragraph, and Back and Forward work as usual.
- Bookmark: the Bookmark button in the article tools marks the article. Bookmarks are kept on this computer for each disc, and a Bookmarks list appears in the contents sidebar for one-click jumping. Press Bookmarked to remove one.
- Show in Diagram: jumps to the diagram and highlights the pin for the article you were reading.
- Cite / Print Preview: shows a page-style preview and a Copy Citation button.
- Read Aloud: your browser's own voice reads the article, one paragraph at a time. The paragraph being read is highlighted, and the button shows how far it has got, for example Stop (2/5). The 1x / 1.2x button next to it sets the speed. Use Stop or the Sound button to silence it.

PICTURES
- When a disc has pictures, the Multimedia Reel shows them in a picture frame with Prev, Next, Enlarge, and a Frame X / Y counter.
- Click a picture, or press Enlarge, to open the Picture Viewer. This is the only place the slideshow plays: Play and Pause step through the pictures every four seconds, and closing the window pauses it. Space starts and pauses the show, Arrow Left and Arrow Right change picture, the thumbnail strip jumps to a picture, and Escape closes the window.
- A picture that cannot be loaded is replaced by an illustration plate.

DIAGRAMS
Click the numbered pins on a diagram to jump to articles. Point at a pin, or tab to it, to see a small preview card with the article's title and its first Quick Fact before you click. Burned discs get a diagram that matches their source: a blueprint for a GitHub repository, a site map for a web page, an outline for Markdown, and a concept chart for a topic.

KEEPMAZE
KeepMaze is a trivia dungeon. Choose an exit, answer a question about the disc to unlock the door, and make your way to the throne room. The Quest card shows your goal and how many rooms you have explored, and the mini-map legend explains its colours. Peek Hint shows the first sentence of the article that holds the answer. A wrong answer keeps the door locked and points you to that article. Every dungeon is checked with a breadth-first search, so the throne room can always be reached.

Your Knowledge Score, Streak, and Torches are in the Quest card. A right answer is worth 100 points, plus 10 more for each right answer you already have in a row (the bonus stops growing after five). If you used Peek Hint on the question, the answer is worth 50 points with no bonus. A wrong answer ends your streak and dims one of your three torches. Torches are only a tally of mistakes: they never lock a door, and you can always keep going. Reach the throne room to earn a Victory Certificate stamped with your Score, Best Streak, and Scholar Rank: Royal Archivist, Court Scholar, Keep Explorer, or Torchbearer.

SOUND
All sound effects are generated live, and no audio files are used: soft chords for clicks and door locks, a projector click when you change pictures, a ding when a disc finishes burning, and a fanfare when you reach the throne room.

The Ambience button in the taskbar is Off until you press it. When it is On, it plays a quiet background atmosphere that suits the open disc: wind and a hearth for castles, a CRT hum for code and web discs, and a soft study tone for the rest. Use the Sound button to mute everything, including Ambience and Read Aloud.

A few pictures move a little: a blinking cursor on the computer screens, flickering torch windows, and a glint on the CD. They stand still if your system asks for reduced motion.

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
