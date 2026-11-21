import { useMemo, useState } from 'react';
import type { FetchLike } from './adapters/types';
import { playSpinUp } from './audio/audio';
import { BurnDialog } from './components/BurnDialog';
import { ArticleViewer } from './components/ArticleViewer';
import { BootSplash } from './components/BootSplash';
import { DesktopIcons } from './components/DesktopIcons';
import { DiscBrowser } from './components/DiscBrowser';
import { ErrorList } from './components/ErrorList';
import { HotspotViewer } from './components/HotspotViewer';
import { KeepMazeUI } from './components/KeepMazeUI';
import { NotepadWindow } from './components/NotepadWindow';
import { Taskbar } from './components/Taskbar';
import type { ActiveWindowInfo } from './components/Taskbar';
import { prebakedDiscs } from './discs';
import { loadDisc } from './discs/loader';
import { createDiscLibrary, getBrowserStorage } from './library/discLibrary';
import type { StorageLike } from './library/discLibrary';
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
}

interface Shell {
  nav: NavState;
  history: History;
}

const initialShell: Shell = { nav: initialNav, history: initialHistory };

export function App({ sources, skipSplash, fetch: fetchImpl, storage }: AppProps) {
  const discSources = sources ?? prebakedDiscs;
  const [stage, setStage] = useState<'splash' | 'home'>(
    (skipSplash ?? sources !== undefined) ? 'home' : 'splash',
  );
  const [lastDiscId, setLastDiscId] = useState<string | null>(null);
  const [shell, setShell] = useState<Shell>(initialShell);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [readMeOpen, setReadMeOpen] = useState(false);
  const { nav, history } = shell;

  const [library] = useState(() =>
    createDiscLibrary(storage ?? (sources === undefined ? getBrowserStorage() : undefined)),
  );
  const [burned, setBurned] = useState<DiscManifest[]>(() => library.load());
  const [burnOpen, setBurnOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);

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

  const openDisc = (discId: string) => {
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
    setBurnOpen(false);
  };
  const removeDisc = (discId: string) => {
    library.remove(discId);
    setBurned((b) => b.filter((x) => x.disc_id !== discId));
    if (nav.discId === discId) closeDisc();
  };
  const closeDisc = () => {
    setNotFound(null);
    setMinimized(false);
    setShell(initialShell);
  };
  /** Visits a view and records it in the history. */
  const visit = (view: View | null) => {
    setNotFound(null);
    setShell((s) => {
      const h = pushView(s.history, view);
      return h === s.history ? s : { nav: { ...s.nav, view }, history: h };
    });
  };
  const move = (step: (h: History) => History) => {
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
      setNotFound(mode === 'diagram' ? 'No interactive diagrams are available.' : 'No KeepMaze dungeons are available.');
      return;
    }
    setNotFound(null);
    setMinimized(false);
    setLastDiscId(target.disc.disc_id);
    setShell({
      nav: { discId: target.disc.disc_id, view: target.view },
      history: pushView(initialHistory, target.view),
    });
  };

  const goSection = (sectionId: string) => {
    const r = selectSection(nav, disc, sectionId);
    setNotFound(r.notFound);
    if (r.state !== nav) visit(r.state.view);
  };

  let main = null;
  // The taskbar tab follows the main window: the open disc, or the Home launcher when none is open.
  const active: ActiveWindowInfo = disc
    ? { title: disc.title, icon: 'cd' }
    : { title: "DiscLore '97 Home", icon: 'home' };
  if (disc && nav.view) {
    const v = nav.view;
    if (v.kind === 'section') {
      main = <ArticleViewer sections={disc.sections} sectionId={v.section_id} onSelectSection={goSection} />;
    } else if (v.kind === 'diagram') {
      const diagram = disc.diagrams.find((d) => d.diagram_id === v.diagram_id);
      if (diagram) {
        main = <HotspotViewer diagram={diagram} onNavigate={goSection} />;
      }
    } else {
      const dungeon = disc.dungeons.find((d) => d.dungeon_id === v.dungeon_id);
      if (dungeon) {
        main = (
          <KeepMazeUI
            key={`${disc.disc_id}/${dungeon.dungeon_id}`}
            disc={disc}
            dungeon={dungeon}
            onOpenSection={goSection}
          />
        );
      }
    }
  }

  if (stage === 'splash') {
    return (
      <div className="desktop desktop--boot">
        <BootSplash onDone={() => setStage('home')} />
      </div>
    );
  }

  return (
    <div className="desktop">
      <div className="desktop__work app-shell">
        <DesktopIcons discs={discs} onOpenDisc={openDisc} onOpenReadMe={() => setReadMeOpen(true)} />
        <DiscBrowser
          discs={discs}
          openDiscId={nav.discId}
          onOpenDisc={openDisc}
          onCloseDisc={closeDisc}
          onSelectSection={goSection}
          onSelectDiagram={(diagram_id) => visit({ kind: 'diagram', diagram_id })}
          onSelectDungeon={(dungeon_id) => visit({ kind: 'keepmaze', dungeon_id })}
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
          onOpenReadMe={() => setReadMeOpen(true)}
          onReplaySplash={() => setStage('splash')}
          onBurnNew={() => setBurnOpen(true)}
          onRemoveDisc={removeDisc}
          removableIds={removable}
        />
        {notFound ? (
          <p role="alert" className="app-not-found">
            {notFound}
          </p>
        ) : null}
        {failures.map((errors, i) => (
          <ErrorList key={i} errors={errors} />
        ))}
        {saveNotice ? (
          <p role="status" className="app-not-found">
            The disc is open, but it could not be saved to this browser.
          </p>
        ) : null}
        {readMeOpen ? <NotepadWindow onClose={() => setReadMeOpen(false)} /> : null}
        {burnOpen ? (
          <BurnDialog
            onBurned={onBurned}
            onClose={() => setBurnOpen(false)}
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
      />
    </div>
  );
}
