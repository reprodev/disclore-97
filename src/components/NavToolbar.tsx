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
  /** Closes the open disc and returns to the disc list. */
  onDiscs: () => void;
  /** Omit when the disc has no diagrams: the button is disabled. */
  onDiagram?: () => void;
  /** Omit when the disc has no dungeons: the button is disabled. */
  onKeepMaze?: () => void;
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
  onKeepMaze,
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
      <Tool icon="torch" label="KeepMaze" disabled={!onKeepMaze} onClick={onKeepMaze} />
    </div>
  );
}
