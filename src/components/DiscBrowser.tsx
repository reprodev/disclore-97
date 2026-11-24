import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { playSpinUp } from '../audio/audio';
import type { Theme } from '../library/theme';
import { editionOf } from '../model/editions';
import type { DiscManifest } from '../model/manifest';
import { hasTimeline } from '../model/timeline';
import type { QuickJumpMode, View } from '../model/nav';
import { BevelButton } from './BevelButton';
import { Breadcrumb } from './Breadcrumb';
import { ContentsSidebar } from './ContentsSidebar';
import { PixelIcon } from './PixelIcon';
import { DiscCover } from './DiscCover';
import { HomeLauncher } from './HomeLauncher';
import { LoadDiscDialog } from './LoadDiscDialog';
import { MenuBar } from './MenuBar';
import { NavToolbar } from './NavToolbar';
import { SpinUpBar } from './SpinUpBar';
import { StatusBar } from './StatusBar';
import { Window } from './Window';
import '../styles/browser.css';
import '../styles/workspace.css';

export interface DiscBrowserProps {
  discs: DiscManifest[];
  /** Id of the open disc, or null when only the disc list is shown. */
  openDiscId: string | null;
  onOpenDisc: (discId: string) => void;
  onCloseDisc: () => void;
  onSelectSection: (sectionId: string) => void;
  onSelectDiagram: (diagramId: string) => void;
  onSelectDungeon: (dungeonId: string) => void;
  /** Opens the disc-wide Timeline view. Omit to hide the Timeline button and View menu item. */
  onSelectTimeline?: () => void;
  /** Bookmarked section ids of the open disc, shown as a list in the sidebar. */
  bookmarks?: readonly string[];
  /** Opens the Media Gallery view. Omit to hide the Gallery button and View menu item. */
  onSelectGallery?: () => void;
  /** Opens Study Flashcards. Omit to hide the Flashcards button and View menu item. */
  onSelectFlashcards?: () => void;
  /** The current edition. With onCycleTheme, the View menu offers an Edition item that cycles it, and the Home window a card. */
  theme?: Theme;
  onCycleTheme?: () => void;
  /** Copies a link that reopens the current disc and view. Omit to hide View > Copy Share Link. */
  onCopyShareLink?: () => void;
  /** Opens Take a Tour. Omit to hide the Tour button and View menu item. */
  onSelectTour?: () => void;
  /** Opens the Research Notebook. Omit to hide the Notebook button, View menu item, and Home card. */
  onOpenNotebook?: () => void;
  /** Opens the Dictionary dialog. Omit to hide the Dictionary button, View menu item, and Home card. */
  onOpenDictionary?: (word?: string) => void;
  /** Opens the Keyboard Shortcuts dialog. Omit to hide the Help menu. */
  onOpenShortcuts?: () => void;
  /** Section ids of the open disc that were already read. */
  visited?: readonly string[];
  /** Current view in the open disc. Drives the sidebar highlight, breadcrumb, and status bar. */
  view?: View | null;
  /** Content for the right-hand pane. When omitted, a welcome page is shown. */
  main?: ReactNode;
  canBack?: boolean;
  canForward?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  /** Returns to the disc home page. */
  onHome?: () => void;
  /** Home hub: open a disc straight to its first diagram or dungeon. */
  onQuickJump?: (mode: QuickJumpMode) => void;
  /** Home hub: open the ReadMe.txt Notepad. */
  onOpenReadMe?: () => void;
  /** Home hub: replay the boot splash. */
  onReplaySplash?: () => void;
  /** Hides the open disc window without closing it. The parent owns this state. */
  minimized?: boolean;
  /** When provided, the open disc window has a Minimize button. */
  onMinimize?: () => void;
  /** Opens the Burn dialog. Omit to hide the File menu item and the launcher buttons. */
  onBurnNew?: () => void;
  /** Saves the open disc as a .json disc image. Omit to hide the File menu item. */
  onSaveImage?: () => void;
  /** Opens the file picker to mount a .json disc image. Omit to hide the menu item and launcher card. */
  onMountImage?: () => void;
  /** Opens a disc straight to a section (Home: Pinpointer, Did You Know?, Surprise Me!). */
  onOpenSection?: (discId: string, sectionId: string) => void;
  /** [0, 1) generator for the Home discovery features. Tests pass a fixed one. */
  random?: () => number;
  /** Exports any disc as a .json disc image (the Home cards for burned discs use it). */
  onSaveDiscImage?: (disc: DiscManifest) => void;
  /** Opens the Burn dialog and burns a sample disc about this topic. */
  onBurnSample?: (topic: string) => void;
  /** Removes a burned disc from the library. */
  onRemoveDisc?: (discId: string) => void;
  /** Ids of burned discs that may be removed. */
  removableIds?: ReadonlySet<string>;
  /** Whether the built-in demo discs are mounted. */
  demoDiscs?: boolean;
  /** Turns the built-in demo discs on or off. Omit to hide the View menu item and the Home checkbox. */
  onToggleDemoDiscs?: (on: boolean) => void;
  /**
   * Burns the full disc for the open offline outline from its saved source. When given, an outline
   * disc shows a banner with a Refresh button and a File > Refresh Disc from Source... item.
   */
  onRefreshDisc?: () => void;
  /** True while a refresh is running: the Refresh controls are dimmed. */
  refreshing?: boolean;
}

/** Plain words for where an outline came from, for its banner. */
function outlineSourceLabel(kind: 'github' | 'webpage' | 'topic'): string {
  if (kind === 'github') return 'the GitHub repository';
  if (kind === 'webpage') return 'the web page';
  return 'Wikipedia';
}

/** Breadcrumb trail and status-bar label for a view. */
function describeView(disc: DiscManifest, view: View | null): { trail: string[]; label: string } {
  if (view?.kind === 'section') {
    const title = disc.sections.find((s) => s.section_id === view.section_id)?.title ?? view.section_id;
    return { trail: ['Sections', title], label: `Section: ${title}` };
  }
  if (view?.kind === 'diagram') {
    const title = disc.diagrams.find((d) => d.diagram_id === view.diagram_id)?.title ?? view.diagram_id;
    return { trail: ['Diagrams', title], label: `Diagram: ${title}` };
  }
  if (view?.kind === 'timeline') {
    return { trail: ['Timeline'], label: 'Timeline' };
  }
  if (view?.kind === 'flashcards') {
    return { trail: ['Flashcards'], label: 'Study Flashcards' };
  }
  if (view?.kind === 'tour') {
    return { trail: ['Tour'], label: 'Take a Tour' };
  }
  if (view?.kind === 'gallery') {
    return { trail: ['Gallery'], label: 'Media Gallery' };
  }
  if (view?.kind === 'keepmaze') {
    const title = disc.dungeons.find((d) => d.dungeon_id === view.dungeon_id)?.title ?? view.dungeon_id;
    return { trail: ['Dungeons', title], label: `KeepMaze: ${title}` };
  }
  return { trail: [], label: 'Contents' };
}

export function DiscBrowser({
  discs,
  openDiscId,
  onOpenDisc,
  onCloseDisc,
  onSelectSection,
  onSelectDiagram,
  onSelectDungeon,
  onSelectTimeline,
  bookmarks,
  onSelectGallery,
  onSelectFlashcards,
  theme = 'classic',
  onCycleTheme,
  onCopyShareLink,
  onSelectTour,
  onOpenNotebook,
  onOpenDictionary,
  onOpenShortcuts,
  visited,
  view = null,
  main,
  canBack = false,
  canForward = false,
  onBack,
  onForward,
  onHome,
  minimized = false,
  onMinimize,
  onQuickJump,
  onOpenReadMe,
  onReplaySplash,
  onBurnNew,
  onSaveImage,
  onMountImage,
  onOpenSection,
  random,
  onSaveDiscImage,
  onBurnSample,
  onRemoveDisc,
  removableIds,
  demoDiscs = true,
  onToggleDemoDiscs,
  onRefreshDisc,
  refreshing = false,
}: DiscBrowserProps) {
  const open = openDiscId === null ? undefined : discs.find((d) => d.disc_id === openDiscId);
  /** Disc id the Load Disc dialog was opened over, or null when it is closed. */
  const [loadOverId, setLoadOverId] = useState<string | null>(null);

  // Any change of the open disc (including closing it) dismisses the dialog.
  useEffect(() => {
    setLoadOverId(null);
  }, [openDiscId]);

  const handleOpen = (discId: string) => {
    playSpinUp();
    onOpenDisc(discId);
  };

  const handleOpenSection = (discId: string, sectionId: string) => {
    playSpinUp();
    onOpenSection?.(discId, sectionId);
  };

  const renderOpen = (disc: DiscManifest) => {
    const first = {
      diagram: disc.diagrams[0]?.diagram_id,
      dungeon: disc.dungeons[0]?.dungeon_id,
    };
    const goBack = () => onBack?.();
    const goForward = () => onForward?.();
    const goHome = () => onHome?.();
    const goDiagram = first.diagram === undefined ? undefined : () => onSelectDiagram(first.diagram!);
    const goTimeline = onSelectTimeline && hasTimeline(disc) ? onSelectTimeline : undefined;
    const goGallery = onSelectGallery;
    const goFlashcards = onSelectFlashcards && disc.sections.length > 0 ? onSelectFlashcards : undefined;
    const goTour = onSelectTour && disc.sections.length > 0 ? onSelectTour : undefined;
    const goNotebook = onOpenNotebook;
    const goDictionary = onOpenDictionary ? () => onOpenDictionary() : undefined;
    const goKeepMaze = first.dungeon === undefined ? undefined : () => onSelectDungeon(first.dungeon!);
    const { trail, label } = describeView(disc, view);
    const refreshable = disc.outline !== undefined && onRefreshDisc !== undefined;
    const goRefresh = () => {
      if (refreshable && !refreshing) onRefreshDisc();
    };

    return (
      <Window
        title={disc.title}
        onClose={onCloseDisc}
        onMinimize={onMinimize}
        minimized={minimized}
        maximizable
        defaultMaximized
        draggable
        className="disc-window"
        menuBar={
          <MenuBar
            menus={[
              {
                label: 'File',
                items: [
                  { label: 'Load Disc...', onSelect: () => setLoadOverId(disc.disc_id) },
                  ...(onBurnNew ? [{ label: 'Burn New Disc...', onSelect: onBurnNew }] : []),
                  ...(onSaveImage ? [{ label: 'Save Disc Image (.json)', onSelect: onSaveImage }] : []),
                  ...(onMountImage ? [{ label: 'Mount Disc Image (.json)...', onSelect: onMountImage }] : []),
                  ...(refreshable ? [{ label: 'Refresh Disc from Source...', onSelect: goRefresh }] : []),
                  { label: 'Close Disc', onSelect: onCloseDisc },
                ],
              },
              {
                label: 'Go',
                items: [
                  { label: 'Back', onSelect: () => canBack && goBack() },
                  { label: 'Forward', onSelect: () => canForward && goForward() },
                  { label: 'Home', onSelect: goHome },
                ],
              },
              {
                label: 'View',
                items: [
                  { label: 'Diagram', onSelect: () => goDiagram?.() },
                  { label: 'Timeline', onSelect: () => goTimeline?.() },
                  { label: 'KeepMaze', onSelect: () => goKeepMaze?.() },
                  ...(goTour ? [{ label: 'Tour', onSelect: () => goTour() }] : []),
                  ...(goFlashcards ? [{ label: 'Flashcards', onSelect: () => goFlashcards() }] : []),
                  ...(goGallery ? [{ label: 'Gallery', onSelect: () => goGallery() }] : []),
                  ...(goDictionary ? [{ label: 'Dictionary...', onSelect: () => goDictionary() }] : []),
                  ...(goNotebook ? [{ label: 'Notebook...', onSelect: () => goNotebook() }] : []),
                  ...(onCycleTheme ? [{ label: `Edition: ${editionOf(theme).name}`, onSelect: onCycleTheme }] : []),
                  ...(onCopyShareLink ? [{ label: 'Copy Share Link', onSelect: onCopyShareLink }] : []),
                  ...(onToggleDemoDiscs
                    ? [{ label: 'Demo Discs (Built-In)', checked: demoDiscs, onSelect: () => onToggleDemoDiscs(!demoDiscs) }]
                    : []),
                ],
              },
              ...(onOpenShortcuts ? [{ label: 'Help', items: [{ label: 'Shortcuts...', onSelect: onOpenShortcuts }] }] : []),
            ]}
          />
        }
      >
        <NavToolbar
          canBack={canBack}
          canForward={canForward}
          onBack={goBack}
          onForward={goForward}
          onHome={goHome}
          onDiscs={() => setLoadOverId(disc.disc_id)}
          onDiagram={goDiagram}
          onTimeline={goTimeline}
          onKeepMaze={goKeepMaze}
          onFlashcards={goFlashcards}
          onTour={goTour}
          onNotebook={goNotebook}
          onGallery={goGallery}
          onDictionary={goDictionary}
        />
        <Breadcrumb discTitle={disc.title} trail={trail} onHome={goHome} />
        <SpinUpBar key={disc.disc_id} />
        {refreshable && disc.outline ? (
          <div className="outline-banner" role="region" aria-label="Offline outline">
            <PixelIcon name="cd" size={16} />
            <p className="outline-banner__text">
              {refreshing
                ? `Dialing ${outlineSourceLabel(disc.outline.kind)} for the full disc...`
                : `Offline outline. This disc stands in for ${outlineSourceLabel(disc.outline.kind)}, which could not be read when it was burned. Your notes, bookmarks, and best score stay with it.`}
            </p>
            <BevelButton className="outline-banner__refresh" disabled={refreshing} onClick={goRefresh}>
              Refresh Full Disc from Source...
            </BevelButton>
          </div>
        ) : null}
        <div className="disc-workspace">
          <ContentsSidebar
            key={disc.disc_id}
            disc={disc}
            view={view}
            onSelectSection={onSelectSection}
            onSelectDiagram={onSelectDiagram}
            onSelectDungeon={onSelectDungeon}
            bookmarks={bookmarks}
            visited={visited}
          />
          <div className="disc-main">
            {main ?? (
              <DiscCover
                disc={disc}
                onOpenArticle={onSelectSection}
                onOpenDiagram={onSelectDiagram}
                onOpenKeepMaze={onSelectDungeon}
              />
            )}
          </div>
        </div>
        <StatusBar discTitle={disc.title} viewLabel={label} />
      </Window>
    );
  };

  if (open) {
    const loading = loadOverId === open.disc_id;
    return (
      <>
        {/* inert keeps focus and clicks out of the disc window while the modal is up; its state stays mounted. */}
        <div className="disc-browser disc-browser--open" inert={loading}>
          {renderOpen(open)}
        </div>
        {loading ? (
          <LoadDiscDialog
            discs={discs}
            currentDiscId={open.disc_id}
            onLoad={(id) => {
              setLoadOverId(null);
              handleOpen(id);
            }}
            onCancel={() => setLoadOverId(null)}
            onBurnNew={onBurnNew}
            removableIds={removableIds}
            onRemoveDisc={onRemoveDisc}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="disc-browser disc-browser--select">
      <HomeLauncher
        discs={discs}
        onPickDisc={handleOpen}
        onQuickJump={onQuickJump}
        onOpenReadMe={onOpenReadMe}
        onOpenDictionary={onOpenDictionary}
        onOpenNotebook={onOpenNotebook}
        theme={theme}
        onCycleTheme={onCycleTheme}
        onReplaySplash={onReplaySplash}
        onBurnNew={onBurnNew}
        onMountImage={onMountImage}
        removableIds={removableIds}
        onOpenSection={onOpenSection ? handleOpenSection : undefined}
        random={random}
        onSaveDiscImage={onSaveDiscImage}
        onRemoveDisc={onRemoveDisc}
        onBurnSample={onBurnSample}
        minimized={minimized}
        onMinimize={onMinimize}
        demoDiscs={demoDiscs}
        onToggleDemoDiscs={onToggleDemoDiscs}
      />
    </div>
  );
}
