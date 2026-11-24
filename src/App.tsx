import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { FetchLike } from './adapters/types';
import {
  ambienceKindFor,
  playBurnComplete,
  playEditionSwitch,
  playKonamiArpeggio,
  playSpinUp,
  setAmbienceKind,
  setAudioEdition,
} from './audio/audio';
import { Starfield } from './components/Starfield';
import { KONAMI_SEQUENCE, konamiStep, STARFIELD_CLICK_GAP_MS, STARFIELD_CLICKS } from './model/easterEggs';
import { refreshDisc } from './adapters/burn';
import { BurnDialog } from './components/BurnDialog';
import { ArticleViewer } from './components/ArticleViewer';
import { BootSplash } from './components/BootSplash';
import { DesktopIcons } from './components/DesktopIcons';
import { DictionaryDialog } from './components/DictionaryDialog';
import { FlashcardsView } from './components/FlashcardsView';
import { MediaGallery } from './components/MediaGallery';
import { NotebookDialog } from './components/NotebookDialog';
import { TourView } from './components/TourView';
import { DiscBrowser } from './components/DiscBrowser';
import { ErrorList } from './components/ErrorList';
import { MessageDialog } from './components/MessageDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { HotspotViewer } from './components/HotspotViewer';
import { KeepMazeUI } from './components/KeepMazeUI';
import { TimelineView } from './components/TimelineView';
import { NotepadWindow } from './components/NotepadWindow';
import { Taskbar } from './components/Taskbar';
import type { ActiveWindowInfo } from './components/Taskbar';
import { prebakedDiscs } from './discs';
import { loadDisc } from './discs/loader';
import { loadBookmarks, saveBookmarks, toggleBookmark } from './library/bookmarks';
import { createDiscLibrary, getBrowserStorage } from './library/discLibrary';
import { applyTheme, loadTheme, saveTheme } from './library/theme';
import { loadDemoDiscs, saveDemoDiscs } from './library/demoDiscs';
import { appendNote, formatNote, loadNotes, loadPinnedNotes, saveNotes, savePinnedNotes, togglePinnedNotes } from './library/notebook';
import { decodeNotes } from './model/noteShare';
import type { SharedNotes } from './model/noteShare';
import { SharedNotesDialog } from './components/SharedNotesDialog';
import { loadVisited, markVisited, saveVisited } from './library/visited';
import {
  MAX_IMAGE_BYTES,
  discImageFileName,
  parseDiscImage,
  readFileText,
  saveTextFile,
  serializeDiscImage,
} from './library/discImage';
import type { StorageLike } from './library/discLibrary';
import { nextTheme } from './library/theme';
import type { Theme } from './library/theme';
import { hasDeepLink, parseDeepLink, resolveDeepLink, shareQuery } from './model/deepLink';
import type { DeckState } from './model/flashcards';
import type { DiscManifest, ValidationError } from './model/manifest';
import {
  canGoBack,
  canGoForward,
  currentView,
  goBack,
  goForward,
  initialHistory,
  initialNav,
  pickQuickJump,
  pushView,
  selectSection,
} from './model/nav';
import type { History, NavState, QuickJumpMode, View } from './model/nav';
import './styles/desktop.css';

export { initialNav, selectSection };
export type { NavState, View };

export interface AppProps {
  /** Disc sources; defaults to the pre-baked discs. Every source goes through loadDisc. */
  sources?: readonly unknown[];
  /**
   * Skips the Stage 1 boot splash and lands on the Home launcher. Defaults to
   * true when sources is passed (tests, embedding) and false when it is
   * omitted, which uses the built-in discs.
   */
  skipSplash?: boolean;
  /** Fetch used by the Burn dialog. Defaults to the global fetch. */
  fetch?: FetchLike;
  /** Storage for burned discs. Defaults to localStorage only when sources is omitted. */
  storage?: StorageLike;
  /** The URL query string to read a deep link from (for example "?disc=castles&section=moat"). Defaults to the page's own. */
  search?: string;
}

interface Shell {
  nav: NavState;
  history: History;
}

const initialShell: Shell = { nav: initialNav, history: initialHistory };

/** What the disc list starts from while Demo Discs (Built-In) is off: nothing, so only burned and mounted discs remain. */
const NO_DISCS: readonly unknown[] = [];
/** Ids of the built-in demo discs, used to leave one cleanly when Demo Discs is turned off. */
const BUILT_IN_IDS: ReadonlySet<string> = new Set(prebakedDiscs.map((d) => d.disc_id));

export function App({ sources, skipSplash, fetch: fetchImpl, storage, search }: AppProps) {
  /** A shared link, read once on load. A link to a disc or a topic skips the boot splash. */
  const [link] = useState(() => parseDeepLink(search ?? (typeof window !== 'undefined' ? window.location.search : '')));
  const [stage, setStage] = useState<'splash' | 'home'>(
    (hasDeepLink(link) || (skipSplash ?? sources !== undefined)) ? 'home' : 'splash',
  );
  const [lastDiscId, setLastDiscId] = useState<string | null>(null);
  const [shell, setShell] = useState<Shell>(initialShell);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [readMeOpen, setReadMeOpen] = useState(false);
  const [readMeMinimized, setReadMeMinimized] = useState(false);
  /** Section whose hotspot is highlighted after "Show in Diagram". Cleared by any other navigation. */
  const [diagramFocus, setDiagramFocus] = useState<string | null>(null);
  /** Bumped on every disc seek (open, burn, mount, navigation): flashes the taskbar's Drive D: LED. */
  const [seekPulse, setSeekPulse] = useState(0);
  const seek = () => setSeekPulse((n) => n + 1);
  const { nav, history } = shell;

  const openReadMe = () => {
    setReadMeMinimized(false);
    setReadMeOpen(true);
  };
  const closeReadMe = () => {
    setReadMeOpen(false);
    setReadMeMinimized(false);
  };

  const [library] = useState(() =>
    createDiscLibrary(storage ?? (sources === undefined ? getBrowserStorage() : undefined)),
  );
  const [burned, setBurned] = useState<DiscManifest[]>(() => library.load());
  // Bookmarks share the library's storage: the browser's localStorage unless a test or embedder supplies one.
  const [bookmarkStorage] = useState(() => storage ?? (sources === undefined ? getBrowserStorage() : undefined));
  /**
   * Demo Discs (Built-In), saved under disclore97.demoDiscs and on by default. It applies only to the
   * built-in discs: a `sources` prop (tests, embedding) supplies its own discs, so it has no toggle.
   * Everything that reads `discs` (the Home shelf, Pinpointer, Dictionary, Did You Know?, Surprise Me!,
   * the desktop icons, and Start > Mounted Discs) follows this one source of truth.
   */
  const demoToggleable = sources === undefined;
  const [demoDiscs, setDemoDiscs] = useState(() => loadDemoDiscs(bookmarkStorage));
  const discSources = sources ?? (demoDiscs ? prebakedDiscs : NO_DISCS);
  /** Built-in ids stay reserved while the demo discs are off, so a mounted image can never take one. */
  const reservedSources = sources ?? prebakedDiscs;
  const [marks, setMarks] = useState<string[]>([]);
  /** Sections of the open disc that have been opened, saved under disclore97.visited.<disc_id>. */
  const [visited, setVisited] = useState<readonly string[]>([]);
  const visitedRef = useRef<readonly string[]>([]);
  /** The Dictionary dialog: null when closed, otherwise the word it opened with ('' for none). */
  const [dictionary, setDictionary] = useState<{ word: string } | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  /** The Research Notebook dialog: null when closed, otherwise the disc whose notes it shows. */
  const [notebookDiscId, setNotebookDiscId] = useState<string | null>(null);
  /** Notes that arrived in a ?notes= link, shown in the Shared Notes dialog. */
  const [sharedNotes, setSharedNotes] = useState<SharedNotes | null>(null);
  /** Zero-based stop of Take a Tour. A different disc starts again at the first stop. */
  const [tourStop, setTourStop] = useState(0);
  /** Progress through the open disc's flashcard deck. Null means a fresh deck. */
  const [deck, setDeck] = useState<DeckState | null>(null);
  const [burnOpen, setBurnOpen] = useState(false);
  /** A sample topic to burn at once when the Burn dialog opens, or null for a normal, empty dialog. */
  const [burnSample, setBurnSample] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState(false);
  /** Id of the outline disc being refreshed from its source, or null. */
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  /** A notice about a disc image that could not be mounted or saved, shown as a Win95 message box. */
  const [imageNotice, setImageNotice] = useState<{ title: string; message: string; details: string[]; footnote?: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const { discs, failures, removable } = useMemo(() => {
    const ok: DiscManifest[] = [];
    const bad: ValidationError[][] = [];
    for (const src of discSources) {
      const r = loadDisc(src, false);
      if (r.ok) ok.push(r.manifest);
      else bad.push(r.errors);
    }
    const baseIds = new Set(ok.map((d) => d.disc_id));
    const removableIds = new Set<string>();
    for (const m of burned) {
      if (baseIds.has(m.disc_id)) continue;
      const r = loadDisc(m, false);
      if (r.ok) {
        ok.push(r.manifest);
        removableIds.add(r.manifest.disc_id);
      }
    }
    return { discs: ok, failures: bad, removable: removableIds };
  }, [discSources, burned]);

  const disc = discs.find((d) => d.disc_id === nav.discId);

  // The ambient soundscape follows the open disc (it stays off until the Ambience button is pressed).
  const ambienceDiscId = disc?.disc_id;
  useEffect(() => {
    setAmbienceKind(ambienceKindFor(ambienceDiscId));
  }, [ambienceDiscId]);

  // Load the open disc's bookmarks when the disc changes.
  const marksDiscId = disc?.disc_id;
  useEffect(() => {
    setMarks(disc ? loadBookmarks(bookmarkStorage, disc.disc_id, new Set(disc.sections.map((s) => s.section_id))) : []);
  }, [marksDiscId]);

  // Load the open disc's visited sections when the disc changes. This must run before the mark effect below.
  useEffect(() => {
    const list = disc ? loadVisited(bookmarkStorage, disc.disc_id, new Set(disc.sections.map((s) => s.section_id))) : [];
    visitedRef.current = list;
    setVisited(list);
  }, [marksDiscId]);

  // Opening a section marks it read.
  const openSectionId = nav.view?.kind === 'section' ? nav.view.section_id : null;
  useEffect(() => {
    if (!disc || openSectionId === null) return;
    const next = markVisited(visitedRef.current, openSectionId);
    if (next === visitedRef.current) return;
    visitedRef.current = next;
    setVisited(next);
    saveVisited(bookmarkStorage, disc.disc_id, next);
  }, [marksDiscId, openSectionId]);

  // Easter egg: the Konami code toggles the "Archive Key '97" stamp in the Home status bar. It listens
  // only while nothing is being typed and no dialog or screensaver is up.
  const [archiveKey, setArchiveKey] = useState(false);
  const konami = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const typing = el !== null && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      if (typing || document.querySelector('.modal-layer, .starfield')) {
        konami.current = 0;
        return;
      }
      konami.current = konamiStep(konami.current, e.key);
      if (konami.current === KONAMI_SEQUENCE.length) {
        konami.current = 0;
        playKonamiArpeggio();
        setArchiveKey((on) => !on);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Easter egg: three quick clicks on the bare desktop (not an icon or a window) start the Starfield.
  const [starfieldOn, setStarfieldOn] = useState(false);
  const desktopClicks = useRef<{ count: number; last: number }>({ count: 0, last: 0 });
  const onDesktopClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const c = desktopClicks.current;
    c.count = e.timeStamp - c.last <= STARFIELD_CLICK_GAP_MS ? c.count + 1 : 1;
    c.last = e.timeStamp;
    if (c.count >= STARFIELD_CLICKS) {
      c.count = 0;
      setStarfieldOn(true);
    }
  };
  const endStarfield = useCallback(() => setStarfieldOn(false), []);

  // Ctrl+D / Cmd+D opens the Dictionary while a disc is open, instead of the browser's bookmark dialog.
  const discIsOpen = disc !== undefined;
  useEffect(() => {
    if (!discIsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'd') return;
      e.preventDefault();
      if (document.querySelector('.modal-layer')) return;
      setDictionary({ word: '' });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [discIsOpen]);

  // A different disc starts its tour again at the first stop.
  useEffect(() => {
    setTourStop(0);
    setDeck(null);
  }, [marksDiscId]);

  // The Haunted Edition theme is a class on the document element, saved under disclore97.theme.
  const [theme, setTheme] = useState<Theme>(() => loadTheme(bookmarkStorage));
  useEffect(() => {
    applyTheme(document.documentElement, theme);
    setAudioEdition(theme);
    return () => {
      applyTheme(document.documentElement, 'classic');
      setAudioEdition('classic');
    };
  }, [theme]);
  const setEdition = (next: Theme) => {
    if (next !== theme) playEditionSwitch(next);
    setTheme(next);
    saveTheme(bookmarkStorage, next);
  };
  const cycleTheme = () => setEdition(nextTheme(theme));

  /** The disc the Notebook belongs to: the open disc, else the last one opened, else the first. */
  const notebookTarget = disc ?? discs.find((d) => d.disc_id === lastDiscId) ?? discs[0];
  /** Notebooks pinned to the desktop, saved under disclore97.pinnedNotes. */
  const [pinnedNotes, setPinnedNotes] = useState<string[]>(() => loadPinnedNotes(bookmarkStorage));
  const togglePin = (discId: string) => {
    const next = togglePinnedNotes(pinnedNotes, discId);
    setPinnedNotes(next);
    savePinnedNotes(bookmarkStorage, next);
  };

  const addNote = (sectionTitle: string, fact: string) => {
    if (!disc) return;
    saveNotes(bookmarkStorage, disc.disc_id, appendNote(loadNotes(bookmarkStorage, disc.disc_id), formatNote(sectionTitle, fact)));
  };

  const toggleMark = (sectionId: string) => {
    if (!disc) return;
    const next = toggleBookmark(marks, sectionId);
    setMarks(next);
    saveBookmarks(bookmarkStorage, disc.disc_id, next);
  };

  const openDisc = (discId: string) => {
    seek();
    setDiagramFocus(null);
    setNotFound(null);
    setMinimized(false);
    setLastDiscId(discId);
    setShell({ nav: { discId, view: null }, history: initialHistory });
  };
  const onBurned = (m: DiscManifest) => {
    setBurned((b) => [...b.filter((x) => x.disc_id !== m.disc_id), m]);
    const saved = library.save(m);
    setSaveNotice(!saved.saved);
    openDisc(m.disc_id);
    playSpinUp();
    playBurnComplete();
    setBurnOpen(false);
  };
  /**
   * Refreshes an offline outline into the full disc from its saved source. On success the new disc
   * replaces the outline in place, under the same disc_id, so its notes, bookmarks, and Personal Best
   * stay. On failure the outline is left untouched and the error is shown in a message box.
   */
  const onRefreshDisc = async (discId: string) => {
    if (refreshingId !== null) return;
    const outline = burned.find((d) => d.disc_id === discId);
    if (!outline?.outline) return;
    setRefreshingId(discId);
    let result;
    try {
      result = await refreshDisc(outline, fetchImpl ? { fetch: fetchImpl } : {});
    } finally {
      setRefreshingId(null);
    }
    if (!result.ok) {
      setImageNotice({
        title: 'Refresh Disc from Source',
        message: result.error.message,
        details: [],
        footnote: 'Your outline disc was left as it was.',
      });
      return;
    }
    const full = result.manifest;
    setBurned((b) => b.map((x) => (x.disc_id === full.disc_id ? full : x)));
    const saved = library.save(full, { keepPosition: true });
    setSaveNotice(!saved.saved);
    // The articles changed, so start the refreshed disc at its cover.
    if (nav.discId === full.disc_id) openDisc(full.disc_id);
    playBurnComplete();
  };
  /** Saves a disc as a .json disc image download. */
  const saveDiscImage = (m: DiscManifest) => {
    if (!saveTextFile(discImageFileName(m), serializeDiscImage(m))) {
      setImageNotice({
        title: 'Save Disc Image',
        message: 'This browser could not save the disc image file.',
        details: [],
      });
    }
  };

  const openImagePicker = () => imageInputRef.current?.click();

  /** Mounts a chosen .json disc image: parse, validate, add to the library, and open it. */
  const mountImage = async (file: File) => {
    const reject = (message: string, details: string[] = [], footnote?: string) =>
      setImageNotice({ title: 'Mount Disc Image', message, details, ...(footnote ? { footnote } : {}) });

    if (file.size > MAX_IMAGE_BYTES) {
      reject('That file is too large to be a disc image.');
      return;
    }
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      reject('The file could not be read.');
      return;
    }
    const parsed = parseDiscImage(text);
    if (!parsed.ok) {
      const shown = parsed.errors.map((e) => `${e.path}: ${e.message}`);
      reject(parsed.message, shown, parsed.errors.length > 0 ? 'Nothing was mounted.' : undefined);
      return;
    }
    const m = parsed.manifest;
    const builtIn = reservedSources.some(
      (s) => typeof s === 'object' && s !== null && (s as { disc_id?: unknown }).disc_id === m.disc_id,
    );
    if (builtIn) {
      reject(`This disc image has the same ID ("${m.disc_id}") as a built-in disc, so it cannot be mounted.`);
      return;
    }
    setBurned((b) => [...b.filter((x) => x.disc_id !== m.disc_id), m]);
    const saved = library.save(m);
    setSaveNotice(!saved.saved);
    openDisc(m.disc_id);
    playSpinUp();
  };

  const removeDisc = (discId: string) => {
    library.remove(discId);
    setBurned((b) => b.filter((x) => x.disc_id !== discId));
    if (nav.discId === discId) closeDisc();
  };
  const closeDisc = () => {
    setDiagramFocus(null);
    setNotFound(null);
    setMinimized(false);
    setShell(initialShell);
  };

  /**
   * Turns Demo Discs (Built-In) on or off and saves it. Turning it off while a built-in disc is open
   * returns to Home, and forgets a built-in disc as the last one used or the open notebook.
   */
  const setDemo = (on: boolean) => {
    if (on === demoDiscs) return;
    setDemoDiscs(on);
    saveDemoDiscs(bookmarkStorage, on);
    if (on) return;
    if (nav.discId !== null && BUILT_IN_IDS.has(nav.discId)) closeDisc();
    if (lastDiscId !== null && BUILT_IN_IDS.has(lastDiscId)) setLastDiscId(null);
    if (notebookDiscId !== null && BUILT_IN_IDS.has(notebookDiscId)) setNotebookDiscId(null);
    setNotFound(null);
  };
  const onToggleDemoDiscs = demoToggleable ? setDemo : undefined;
  const hasSections = discs.some((d) => d.sections.length > 0);
  /** Visits a view and records it in the history. */
  const visit = (view: View | null) => {
    seek();
    setDiagramFocus(null);
    setNotFound(null);
    setShell((s) => {
      const h = pushView(s.history, view);
      return h === s.history ? s : { nav: { ...s.nav, view }, history: h };
    });
  };
  const move = (step: (h: History) => History) => {
    seek();
    setDiagramFocus(null);
    setNotFound(null);
    setShell((s) => {
      const h = step(s.history);
      return h === s.history ? s : { nav: { ...s.nav, view: currentView(h) }, history: h };
    });
  };

  /** Home hub Quick Jump: opens a disc with the target view already on the history stack. */
  const quickJump = (mode: QuickJumpMode) => {
    const target = pickQuickJump(discs, lastDiscId, mode);
    if (!target) {
      setNotFound(
        mode === 'diagram'
          ? 'No interactive diagrams are available.'
          : mode === 'tour'
            ? 'No tours are available.'
            : mode === 'flashcards'
              ? 'No flashcards are available.'
              : 'No KeepMaze dungeons are available.',
      );
      return;
    }
    seek();
    setDiagramFocus(null);
    setNotFound(null);
    setMinimized(false);
    setLastDiscId(target.disc.disc_id);
    setShell({
      nav: { discId: target.disc.disc_id, view: target.view },
      history: pushView(initialHistory, target.view),
    });
  };

  /** Opens a diagram and highlights the hotspot that cites `sectionId`. */
  const showInDiagram = (diagram_id: string, sectionId: string) => {
    visit({ kind: 'diagram', diagram_id });
    setDiagramFocus(sectionId); // after visit, which clears it
  };

  /** Home discovery (Pinpointer, Did You Know?, Surprise Me!): opens a disc straight to one article. */
  const openSectionIn = (discId: string, sectionId: string) => {
    const target = discs.find((d) => d.disc_id === discId);
    if (!target || !target.sections.some((s) => s.section_id === sectionId)) return;
    const view: View = { kind: 'section', section_id: sectionId };
    seek();
    setDiagramFocus(null);
    setNotFound(null);
    setMinimized(false);
    setLastDiscId(discId);
    setShell({ nav: { discId, view }, history: pushView(initialHistory, view) });
  };

  const goSection = (sectionId: string) => {
    const r = selectSection(nav, disc, sectionId);
    setNotFound(r.notFound);
    if (r.state !== nav) visit(r.state.view);
  };

  // A shared link is applied once, after the discs are known: a topic starts its burn, a disc opens on its view.
  const linkApplied = useRef(false);
  useEffect(() => {
    if (linkApplied.current || !hasDeepLink(link)) return;
    linkApplied.current = true;
    if (link.notes !== undefined) {
      const shared = decodeNotes(link.notes);
      if (shared) setSharedNotes(shared);
      else setImageNotice({ title: 'Shared Notes Link', message: 'This shared notes link is damaged or incomplete, so there is nothing to show.', details: [] });
    }
    // A notes link shows its dialog; a topic in the same link would open a second modal, so it waits.
    if (link.topic !== undefined && link.notes === undefined) {
      setBurnSample(link.topic);
      setBurnOpen(true);
      return;
    }
    const target = resolveDeepLink(link, discs);
    if (!target) return;
    setLastDiscId(target.discId);
    setShell({ nav: { discId: target.discId, view: target.view }, history: pushView(initialHistory, target.view) });
  }, []);

  /** Copies a link that reopens the current disc and view. Without clipboard access, it is shown in a message box. */
  const [shareCopied, setShareCopied] = useState(false);
  useEffect(() => {
    if (!shareCopied) return;
    const id = window.setTimeout(() => setShareCopied(false), 3000);
    return () => window.clearTimeout(id);
  }, [shareCopied]);
  const copyShareLink = async () => {
    if (!disc) return;
    const url = window.location.href.split(/[?#]/)[0] + shareQuery(disc.disc_id, nav.view);
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
    } catch {
      setImageNotice({ title: 'Copy Share Link', message: 'Copy this link to share the page:', details: [url] });
    }
  };

  let main = null;
  // The taskbar tab follows the main window: the open disc, or the Home launcher when none is open.
  const active: ActiveWindowInfo = disc
    ? { title: disc.title, icon: 'cd' }
    : { title: "DiscLore '97 Home", icon: 'home' };
  if (disc && nav.view) {
    const v = nav.view;
    if (v.kind === 'section') {
      main = (
        <ArticleViewer
          sections={disc.sections}
          sectionId={v.section_id}
          onSelectSection={goSection}
          discTitle={disc.title}
          diagrams={disc.diagrams}
          onShowInDiagram={showInDiagram}
          bookmarked={marks.includes(v.section_id)}
          onToggleBookmark={() => toggleMark(v.section_id)}
          onLookUpWord={(word) => setDictionary({ word })}
          {...(bookmarkStorage ? { onAddNote: addNote } : {})}
          {...(disc.media ? { media: disc.media } : {})}
        />
      );
    } else if (v.kind === 'flashcards') {
      main = <FlashcardsView disc={disc} deck={deck} onDeck={setDeck} onOpenSection={goSection} />;
    } else if (v.kind === 'tour') {
      main = <TourView disc={disc} stop={tourStop} onStop={setTourStop} onOpenSection={goSection} />;
    } else if (v.kind === 'gallery') {
      main = <MediaGallery disc={disc} onOpenSection={goSection} />;
    } else if (v.kind === 'timeline') {
      main = <TimelineView disc={disc} onSelectSection={goSection} />;
    } else if (v.kind === 'diagram') {
      const diagram = disc.diagrams.find((d) => d.diagram_id === v.diagram_id);
      if (diagram) {
        main = (
          <HotspotViewer
            diagram={diagram}
            sections={disc.sections}
            onNavigate={goSection}
            highlightSectionId={diagramFocus}
          />
        );
      }
    } else {
      const dungeon = disc.dungeons.find((d) => d.dungeon_id === v.dungeon_id);
      if (dungeon) {
        main = (
          <KeepMazeUI
            key={`${disc.disc_id}/${dungeon.dungeon_id}`}
            disc={disc}
            dungeon={dungeon}
            storage={bookmarkStorage}
            onOpenSection={goSection}
          />
        );
      }
    }
  }

  if (stage === 'splash') {
    return (
      <div className="desktop desktop--boot">
        <BootSplash onDone={() => setStage('home')} edition={theme} />
      </div>
    );
  }

  return (
    <div className="desktop">
      <div className="desktop__work app-shell" onClick={onDesktopClick}>
        <DesktopIcons
          discs={discs}
          onOpenDisc={openDisc}
          onOpenReadMe={openReadMe}
          pinnedNotes={pinnedNotes}
          onOpenNotes={(id) => setNotebookDiscId(id)}
        />
        <DiscBrowser
          discs={discs}
          openDiscId={nav.discId}
          onOpenDisc={openDisc}
          onCloseDisc={closeDisc}
          onSelectSection={goSection}
          onSelectDiagram={(diagram_id) => visit({ kind: 'diagram', diagram_id })}
          onSelectDungeon={(dungeon_id) => visit({ kind: 'keepmaze', dungeon_id })}
          onSelectTimeline={() => visit({ kind: 'timeline' })}
          onSelectGallery={() => visit({ kind: 'gallery' })}
          onSelectTour={() => visit({ kind: 'tour' })}
          onSelectFlashcards={() => visit({ kind: 'flashcards' })}
          theme={theme}
          onCycleTheme={cycleTheme}
          onCopyShareLink={() => void copyShareLink()}
          onOpenNotebook={notebookTarget ? () => setNotebookDiscId(notebookTarget.disc_id) : undefined}
          onOpenDictionary={(word) => setDictionary({ word: word ?? '' })}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          bookmarks={marks}
          visited={visited}
          view={nav.view}
          main={main}
          canBack={canGoBack(history)}
          canForward={canGoForward(history)}
          onBack={() => move(goBack)}
          onForward={() => move(goForward)}
          onHome={() => visit(null)}
          minimized={minimized}
          onMinimize={() => setMinimized(true)}
          onQuickJump={quickJump}
          onOpenReadMe={openReadMe}
          onReplaySplash={() => setStage('splash')}
          onBurnNew={() => {
            setBurnSample(null);
            setBurnOpen(true);
          }}
          onBurnSample={(topic) => {
            setBurnSample(topic);
            setBurnOpen(true);
          }}
          onSaveImage={() => disc && saveDiscImage(disc)}
          onSaveDiscImage={saveDiscImage}
          onOpenSection={openSectionIn}
          onMountImage={openImagePicker}
          onRemoveDisc={removeDisc}
          removableIds={removable}
          demoDiscs={demoDiscs}
          onToggleDemoDiscs={onToggleDemoDiscs}
          archiveKey={archiveKey}
          onRefreshDisc={disc && removable.has(disc.disc_id) ? () => void onRefreshDisc(disc.disc_id) : undefined}
          refreshing={refreshingId !== null && refreshingId === disc?.disc_id}
        />
        {notFound ? (
          <p role="alert" className="app-not-found">
            {notFound}
          </p>
        ) : null}
        {failures.map((errors, i) => (
          <ErrorList key={i} errors={errors} />
        ))}
        {shareCopied ? (
          <p role="status" className="app-not-found">
            Link copied to the clipboard.
          </p>
        ) : null}
        {saveNotice ? (
          <p role="status" className="app-not-found">
            The disc is open, but it could not be saved to this browser.
          </p>
        ) : null}
        <input
          ref={imageInputRef}
          type="file"
          className="disc-image-input"
          accept=".json,application/json"
          aria-label="Mount Disc Image file"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void mountImage(file);
          }}
        />
        {imageNotice ? (
          <MessageDialog
            title={imageNotice.title}
            message={imageNotice.message}
            details={imageNotice.details}
            footnote={imageNotice.footnote}
            onClose={() => setImageNotice(null)}
          />
        ) : null}
        {readMeOpen ? (
          <NotepadWindow
            onClose={closeReadMe}
            onMinimize={() => setReadMeMinimized(true)}
            minimized={readMeMinimized}
          />
        ) : null}
        {notebookDiscId !== null && discs.some((d) => d.disc_id === notebookDiscId) ? (
          <NotebookDialog
            discs={discs}
            discId={notebookDiscId}
            storage={bookmarkStorage}
            pinned={pinnedNotes}
            {...(bookmarkStorage ? { onTogglePin: togglePin } : {})}
            onClose={() => setNotebookDiscId(null)}
          />
        ) : null}
        {sharedNotes ? (
          <SharedNotesDialog
            shared={sharedNotes}
            discs={discs}
            fallbackDiscId={disc?.disc_id ?? lastDiscId ?? undefined}
            storage={bookmarkStorage}
            onClose={() => setSharedNotes(null)}
          />
        ) : null}
        {shortcutsOpen ? <ShortcutsDialog onClose={() => setShortcutsOpen(false)} /> : null}
        {dictionary ? (
          <DictionaryDialog
            discs={discs}
            initialWord={dictionary.word}
            onClose={() => setDictionary(null)}
            onOpenSection={openSectionIn}
            {...(fetchImpl ? { fetch: fetchImpl } : {})}
          />
        ) : null}
        {burnOpen ? (
          <BurnDialog
            onBurned={onBurned}
            onClose={() => setBurnOpen(false)}
            {...(burnSample ? { initialText: burnSample, autoStart: true } : {})}
            {...(fetchImpl ? { fetch: fetchImpl } : {})}
          />
        ) : null}
      </div>
      <Taskbar
        discs={discs}
        active={active}
        minimized={minimized}
        onToggleActive={() => setMinimized((m) => !m)}
        onOpenDisc={openDisc}
        onCloseAll={closeDisc}
        readMeOpen={readMeOpen}
        readMeMinimized={readMeMinimized}
        onToggleReadMe={() => setReadMeMinimized((m) => !m)}
        driveActive={disc !== undefined}
        activityKey={seekPulse}
        startActions={{
          onBurnNew: () => {
            setBurnSample(null);
            setBurnOpen(true);
          },
          onMountImage: openImagePicker,
          onOpenDictionary: () => setDictionary({ word: '' }),
          // With no disc that has articles, these are dimmed rather than offered and then refused.
          onTour: hasSections ? () => quickJump('tour') : undefined,
          onFlashcards: hasSections ? () => quickJump('flashcards') : undefined,
          onOpenReadMe: openReadMe,
          onReplaySplash: () => setStage('splash'),
          onSetTheme: setEdition,
          theme,
          demoDiscs,
          onToggleDemoDiscs,
        }}
      />
      {starfieldOn ? <Starfield onExit={endStarfield} /> : null}
    </div>
  );
}
