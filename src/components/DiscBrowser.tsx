import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { playSpinUp } from '../audio/audio';
import type { DiscManifest } from '../model/manifest';
import type { QuickJumpMode, View } from '../model/nav';
import { Breadcrumb } from './Breadcrumb';
import { ContentsSidebar } from './ContentsSidebar';
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
  /** Removes a burned disc from the library. */
  onRemoveDisc?: (discId: string) => void;
  /** Ids of burned discs that may be removed. */
  removableIds?: ReadonlySet<string>;
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
  onRemoveDisc,
  removableIds,
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

  const renderOpen = (disc: DiscManifest) => {
    const first = {
      diagram: disc.diagrams[0]?.diagram_id,
      dungeon: disc.dungeons[0]?.dungeon_id,
    };
    const goBack = () => onBack?.();
    const goForward = () => onForward?.();
    const goHome = () => onHome?.();
    const goDiagram = first.diagram === undefined ? undefined : () => onSelectDiagram(first.diagram!);
    const goKeepMaze = first.dungeon === undefined ? undefined : () => onSelectDungeon(first.dungeon!);
    const { trail, label } = describeView(disc, view);

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
                  { label: 'KeepMaze', onSelect: () => goKeepMaze?.() },
                ],
              },
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
          onKeepMaze={goKeepMaze}
        />
        <Breadcrumb discTitle={disc.title} trail={trail} onHome={goHome} />
        <SpinUpBar key={disc.disc_id} />
        <div className="disc-workspace">
          <ContentsSidebar
            key={disc.disc_id}
            disc={disc}
            view={view}
            onSelectSection={onSelectSection}
            onSelectDiagram={onSelectDiagram}
            onSelectDungeon={onSelectDungeon}
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
        onReplaySplash={onReplaySplash}
        onBurnNew={onBurnNew}
        minimized={minimized}
        onMinimize={onMinimize}
      />
    </div>
  );
}
