import type { ReactNode } from 'react';
import { playSpinUp } from '../audio/audio';
import type { DiscManifest } from '../model/manifest';
import type { View } from '../model/nav';
import { BevelButton } from './BevelButton';
import { Breadcrumb } from './Breadcrumb';
import { ContentsSidebar } from './ContentsSidebar';
import { DiscCover } from './DiscCover';
import { MenuBar } from './MenuBar';
import { NavToolbar } from './NavToolbar';
import { PixelIcon } from './PixelIcon';
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
}: DiscBrowserProps) {
  const open = openDiscId === null ? undefined : discs.find((d) => d.disc_id === openDiscId);

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
        className="disc-window"
        menuBar={
          <MenuBar
            menus={[
              { label: 'File', items: [{ label: 'Close Disc', onSelect: onCloseDisc }] },
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
          onDiscs={onCloseDisc}
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
    return <div className="disc-browser disc-browser--open">{renderOpen(open)}</div>;
  }

  return (
    <div className="disc-browser disc-browser--select">
      <Window title="DiscLore '97 - Select a CD-ROM" className="disc-select-window">
        <div className="disc-select">
          <p className="disc-select__prompt">Insert a disc to begin.</p>
          {discs.length === 0 ? <p className="disc-select__empty">No discs are available.</p> : null}
          <ul className="disc-list" aria-label="Discs">
            {discs.map((disc) => (
              <li key={disc.disc_id} className="disc-list-item">
                <BevelButton
                  className="disc-open"
                  aria-pressed={disc.disc_id === openDiscId}
                  onClick={() => handleOpen(disc.disc_id)}
                >
                  <PixelIcon name="cd" size={32} />
                  <span className="disc-text">
                    <span className="disc-title">{disc.title}</span>
                    <span className="disc-tagline">{disc.tagline}</span>
                  </span>
                </BevelButton>
              </li>
            ))}
          </ul>
        </div>
      </Window>
    </div>
  );
}