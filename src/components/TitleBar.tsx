import { BevelButton } from './BevelButton';
import '../styles/window.css';

export interface TitleBarProps {
  title: string;
  titleId?: string;
  /** When omitted, no close button is shown. */
  onClose?: () => void;
}

export function TitleBar({ title, titleId, onClose }: TitleBarProps) {
  return (
    <div className="window-title-bar">
      <span id={titleId} className="window-title-text">
        {title}
      </span>
      {onClose ? (
        <BevelButton className="window-close" aria-label="Close" onClick={() => onClose()}>
          <span aria-hidden="true">x</span>
        </BevelButton>
      ) : null}
    </div>
  );
}
