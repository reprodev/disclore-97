import { useId } from 'react';
import type { ReactNode } from 'react';
import { TitleBar } from './TitleBar';
import '../styles/window.css';

export interface WindowProps {
  title: string;
  /** When omitted, the title bar has no close button. */
  onClose?: () => void;
  menuBar?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Window({ title, onClose, menuBar, children, className }: WindowProps) {
  const titleId = useId();
  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      className={className ? `window ${className}` : 'window'}
    >
      <TitleBar title={title} titleId={titleId} onClose={onClose} />
      {menuBar ? <div className="window-menubar">{menuBar}</div> : null}
      <div className="window-content">{children}</div>
    </div>
  );
}
