import { useT } from '../i18n/LocaleContext';
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
  /** Opens Study Flashcards. */
  onFlashcards?: () => void;
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
  onFlashcards,
  onTour,
  onNotebook,
  onGallery,
  onDictionary,
}: NavToolbarProps) {
  const tr = useT();
  return (
    <div className="nav-toolbar" role="toolbar" aria-label="Navigation">
      <Tool icon="back" label={tr('menu_back')} disabled={!canBack} onClick={onBack} />
      <Tool icon="forward" label={tr('menu_forward')} disabled={!canForward} onClick={onForward} />
      <span className="nav-toolbar__sep" aria-hidden="true" />
      <Tool icon="home" label={tr('menu_home')} onClick={onHome} />
      <Tool icon="cd" label={tr('tool_discs')} onClick={onDiscs} />
      <span className="nav-toolbar__sep" aria-hidden="true" />
      <Tool icon="diagram" label={tr('menu_diagram')} disabled={!onDiagram} onClick={onDiagram} />
      <Tool icon="notepad" label={tr('menu_timeline')} disabled={!onTimeline} onClick={onTimeline} />
      <Tool icon="torch" label={tr('menu_keepmaze')} disabled={!onKeepMaze} onClick={onKeepMaze} />
      <span className="nav-toolbar__sep" aria-hidden="true" />
      <Tool icon="castle" label={tr('menu_tour')} disabled={!onTour} onClick={onTour} />
      <Tool icon="key" label={tr('menu_flashcards')} disabled={!onFlashcards} onClick={onFlashcards} />
      <Tool icon="cd" label={tr('menu_gallery')} disabled={!onGallery} onClick={onGallery} />
      <Tool icon="book" label={tr('tool_dictionary')} disabled={!onDictionary} onClick={onDictionary} />
      <Tool icon="notepad" label={tr('tool_notebook')} disabled={!onNotebook} onClick={onNotebook} />
    </div>
  );
}
