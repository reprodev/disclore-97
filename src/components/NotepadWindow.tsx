import { MenuBar } from './MenuBar';
import { Window } from './Window';
import '../styles/shortcuts.css';

export const README_TEXT = `DiscLore '97 - ReadMe

DiscLore '97 is a make-believe 1997 CD-ROM encyclopedia. The four built-in discs are completely original, and the app is an unaffiliated tribute to the multimedia reference discs of the 1990s.

DISCS
- Four pre-baked Expansion Packs ship with the app: Ancient Castles and Keeps; Retro Computing and the Dial-Up Era; Folklore, Samhain and Halloween; and Lost Formats and Digital Resurrection.
- The Home window is styled like a 1997 multimedia encyclopedia: a DISCLORE 97 masthead on warm parchment, with faint engraved line art (a ringed planet, an open book, an arch and keep, and orbiting CD rings) behind it. The right-hand column lists Quick Jump Modes and Utilities as plain rows, each with an icon, a title, and a short italic note. A row pops up with a raised button edge when you point at it.
- The Pinpointer searches every disc. Type two or more letters to see matching articles, with the disc and where it came from. The last row of the list always reads Burn CD-R for your words (Wikipedia)..., so a search with no matches can become a new disc: press Enter on it, or click it, and the burn starts at once.
- Home also has a Did You Know? box and Surprise Me!. If you have not burned any discs yet, the Burned CD-Rs tab offers three sample burns. In Classic '97 they are Halloween, Gothic fiction, and CD-ROM, and each edition has its own three.
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
- Cite / Print Preview: shows a page-style preview, a Copy Citation button, and a Print... button. Print... opens your browser's print window. Only the citation sheet is printed, in dark ink on ivory paper, and the desktop, taskbar, toolbars, and sidebar are left out.
- Read Aloud: your browser's own voice reads the article, one paragraph at a time. The paragraph being read is highlighted, and the button shows how far it has got, for example Stop (2/5). The 1x / 1.2x button next to it sets the speed. Use Stop or the Sound button to silence it.

LOOKING THINGS UP
- Dictionary: the Dictionary button on the toolbar, View > Dictionary..., and the Dictionary card on the Home window open a word finder. Double-click a single word in an article to open it with that word filled in. As you type, it lists where the word appears on every open disc: article titles, Quick Facts, and sentences. Click a result to open that article. Press Look Up to fetch a short definition, which needs a connection. If the word is not found or you are offline, the matches from your discs are still shown.
- Media Gallery: the Gallery button shows a contact sheet for the open disc. If the disc has pictures, click one to open it in the Picture Viewer. If it has none, each article is shown as an illustration plate, and a click opens that article.
- Read articles: the contents list puts a check mark beside every article you have opened and shows how many you have read, for example 3 / 10 read. This is kept on this computer for each disc.
- Keyboard shortcuts: while an article is open, Ctrl+F (Cmd+F on a Mac) opens the Find in Article bar instead of your browser's own find. While any disc is open, Ctrl+D (Cmd+D) opens the Dictionary instead of bookmarking the page. Help > Shortcuts... lists every shortcut, including the Picture Viewer keys, the Pinpointer keys, and Tab and Esc in dialogs.
- Find in Article: the Find in Article button opens a search bar for the open article. Matches are highlighted, and Previous match, Next match, or Enter and Shift+Enter step through them. Escape closes the bar.

STUDY TOOLS
- Take a Tour: the Tour button (or View > Tour, or the Take a Tour row on the Home window) walks through the open disc one article at a time. Each stop is an index-style card with a Stop X of Y progress bar, the article title, its picture or illustration plate, a spotlight fact, and a badge for its first dated event. Previous and Next move between stops, Read Stop Aloud reads the stop with your browser's voice, and Open Full Article opens the whole article. Back from the article returns to the same stop.
- Media Show: Play Show runs the tour by itself, like a 1990s Look and Listen show. With sound on and a voice available, each stop is read aloud and the tour moves on when the reading ends. With sound muted, or with no voice, each stop stays for 5 seconds. The show stops at the last stop. Pause Show, Mute, Previous, Next, or leaving the tour stops it at once.
- Research Notebook: the Notebook button (or View > Notebook..., the Notebook card on the Home window, or a pinned Notes.txt icon on the desktop) opens an ivory study pad, with a character and line count. The Disc list at the top switches between the notebooks of every open disc without closing the window. The + Note button beside a Quick Fact adds that fact, with its article title, to the pad. The + Quote button in the article tools adds the text you have selected in the article, in quotation marks with the article title, or the article's first sentence when nothing is selected. Whatever you type is kept on this computer for each disc. Clear empties the pad. Export (.txt) saves it as a plain text file, and Export (.md) saves it as a Markdown file headed with the disc title. Print... prints just the notes, on a clean page.
- Pin to Desktop: the Pin to Desktop button in the Notebook puts a Notes.txt icon for that disc on the desktop, for example Ancient Castles Notes.txt. Double-click it, or press Enter on it, to open those notes. Press Pinned to Desktop to take the icon away again.
- Sharing notes: Copy Share Link in the Notebook copies a web address that carries the notes themselves, up to the first 4000 characters. If the clipboard is not available, the address appears in the Notebook for you to copy. Opening such an address shows a Shared Notes window with the disc the notes came from and the notes, read-only. Nothing is saved until you press Save to My Notebook, which adds the notes to the end of that disc's notebook, or of a notebook you choose when that disc is not on your computer. A damaged address shows a short message instead.
- Study Flashcards: the Flashcards button (or View > Flashcards, or the Study Flashcards row on the Home window) turns the disc's trivia questions and Quick Facts into index cards. Flip Card, or press Space, shows the answer. Got It marks the card mastered. Need Review puts it back a few cards later. The top of the page shows Card X of Y and how many cards you have mastered. When every card is mastered, Restart Deck starts again, and Open Source Article jumps to the article a card came from.
- Start menu: the Start button on the taskbar opens a Start menu with a DiscLore 97 strip down its left side. Mounted Discs opens a list of every disc you can open, Burn New CD-R Disc..., Mount Disc Image (.json)..., Dictionary..., Take a Tour, and Study Flashcards do what their names say, Edition Switcher lets you pick an edition, and About / ReadMe.txt, Replay Intro Splash, and Close All Windows finish the list. Use the Up and Down keys to move through the menu, Right to open a submenu, Left to close it, Home and End to jump to the first and last item, Enter to choose, and Esc, or a click outside the menu, to close it.
- Share links: View > Copy Share Link copies a web address that reopens the disc and page you are on, so you can send it to someone who has the same disc. An address can end in ?disc=<disc id> to open a disc, add &section=<article id> to open an article, or add &view=diagram, timeline, keepmaze, tour, flashcards, or gallery to open that page. An address ending in ?topic=<words> opens the Burn window and starts burning a disc about those words. An address that names a disc or article that is not on your computer is ignored, and you land on the Home window or the disc's cover instead.
- Editions: DiscLore '97 comes in three editions. Classic '97 is the original look. Haunted Edition is a Kiroween look with midnight indigo, pumpkin amber, deep crimson, and bone-ivory paper. Christmas Edition is a 1997 holiday look with evergreen pine, cranberry and holly crimson, frost-ivory paper, and warm candle gold. View > Edition, the Edition card on the Home window, and Start > Edition Switcher change it, and the choice is kept on this computer. If you chose Winter Solstice in an earlier version, you now get the Christmas Edition. Each edition has its own pictures, lettering, and sounds: the title picture and the faint drawings behind the Home window change (a haunted keep under a crescent moon for Haunted, snowy evergreens, a lit keep and cottage, and a golden star for Christmas), the DISCLORE title uses a different typeface, and a short chime plays when you switch. The edition also changes the line above the DISCLORE 97 title and on the boot screen, starts the Did You Know? box on a disc that suits the edition, and changes the sample burns offered on an empty Burned CD-Rs tab: Halloween, Gothic fiction, and Ghostlore for Haunted, and Christmas, A Christmas Carol, and Christmas tree for Christmas.
- If something goes wrong: should DiscLore '97 ever fail while drawing the screen, it shows a small error window with the problem instead of an empty desktop. Restart DiscLore '97 reloads the program. Restart in Classic '97 also switches back to the original edition first. Your discs, bookmarks, and notes are kept either way.

PICTURES
- When a disc has pictures, the Multimedia Reel shows them in a picture frame with Prev, Next, Enlarge, and a Frame X / Y counter.
- Click a picture, or press Enlarge, to open the Picture Viewer. This is the only place the slideshow plays: Play and Pause step through the pictures every four seconds, and closing the window pauses it. Space starts and pauses the show, Arrow Left and Arrow Right change picture, the thumbnail strip jumps to a picture, and Escape closes the window.
- A picture that cannot be loaded is replaced by an illustration plate.

DIAGRAMS
Click the numbered pins on a diagram to jump to articles. Point at a pin, or tab to it, to see a small preview card with the article's title and its first Quick Fact before you click. Burned discs get a diagram that matches their source: a blueprint for a GitHub repository, a site map for a web page, an outline for Markdown, and a concept chart for a topic.

KEEPMAZE
KeepMaze is a trivia dungeon. Choose an exit, answer a question about the disc to unlock the door, and make your way to the throne room. The Quest card shows your goal and how many rooms you have explored, and the mini-map legend explains its colours. Peek Hint shows the first sentence of the article that holds the answer. A wrong answer keeps the door locked and points you to that article. Every dungeon is checked with a breadth-first search, so the throne room can always be reached.

Your Knowledge Score, Streak, and Torches are in the Quest card. A right answer is worth 100 points, plus 10 more for each right answer you already have in a row (the bonus stops growing after five). If you used Peek Hint on the question, the answer is worth 50 points with no bonus. A wrong answer ends your streak and dims one of your three torches. Torches are only a tally of mistakes: they never lock a door, and you can always keep going. Reach the throne room to earn a Victory Certificate stamped with your Score, Best Streak, and Scholar Rank: Royal Archivist, Court Scholar, Keep Explorer, or Torchbearer.

Your Personal Best for each disc is kept on this computer. It is replaced when you finish a maze with a higher score, or with the same score and a better rank. Once there is one, the Quest card shows it, for example Personal Best: 210 pts (Royal Archivist), and a run that sets a new record is marked New Personal Best! on the certificate.

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
