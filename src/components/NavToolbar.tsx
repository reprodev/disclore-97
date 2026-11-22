import { BevelButton } from './BevelButton';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './PixelIcon';
import '../styles/workspace.css';

export interface NavToolbarProps {
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onHome: () => void;
  /** Opens the Load Disc dialog over the current disc. */
  onDiscs: () => void;
  /** Omit when the disc has no diagrams: the button is disabled. */
  onDiagram?: () => void;
  /** Omit when no section has timeline entries: the button is disabled. */
  onTimeline?: () => void;
  /** Omit when the disc has no dungeons: the button is disabled. */
  onKeepMaze?: () => void;
  /** Opens Take a Tour. */
  onTour?: () => void;
  /** Opens the Research Notebook. */
  onNotebook?: () => void;
  /** Opens the Media Gallery contact sheet. */
  onGallery?: () => void;
  /** Opens the Dictionary dialog. */
  onDictionary?: () => void;
}

function Tool({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <BevelButton className="nav-tool" disabled={disabled} onClick={() => onClick?.()}>
      <PixelIcon name={icon} />
      <span>{label}</span>
    </BevelButton>
  );
}

/** Beveled navigation toolbar: history, home, and quick jumps. */
export function NavToolbar({
  canBack,
  canForward,
  onBack,
  onForward,
  onHome,
  onDiscs,
  onDiagram,
  onTimeline,
  onKeepMaze,
  onTour,
  onNotebook,
  onGallery,
  onDictionary,
}: NavToolbarProps) {
  return (
    <div className="nav-toolbar" role="toolbar" aria-label="Navigation">
      <Tool icon="back" label="Back" disabled={!canBack} onClick={onBack} />
      <Tool icon="forward" label="Forward" disabled={!canForward} onClick={onForward} />
      <span className="nav-toolbar__sep" aria-hidden="true" />
      <Tool icon="home" label="Home" onClick={onHome} />
      <Tool icon="cd" label="Discs" onClick={onDiscs} />
      <span className="nav-toolbar__sep" aria-hidden="true" />
      <Tool icon="diagram" label="Diagram" disabled={!onDiagram} onClick={onDiagram} />
      <Tool icon="notepad" label="Timeline" disabled={!onTimeline} onClick={onTimeline} />
      <Tool icon="torch" label="KeepMaze" disabled={!onKeepMaze} onClick={onKeepMaze} />
      <span className="nav-toolbar__sep" aria-hidden="true" />
      <Tool icon="castle" label="Tour" disabled={!onTour} onClick={onTour} />
      <Tool icon="cd" label="Gallery" disabled={!onGallery} onClick={onGallery} />
      <Tool icon="book" label="Dictionary" disabled={!onDictionary} onClick={onDictionary} />
      <Tool icon="notepad" label="Notebook" disabled={!onNotebook} onClick={onNotebook} />
    </div>
  );
}
