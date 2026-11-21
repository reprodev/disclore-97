import type { HTMLAttributes } from 'react';
import { BevelButton } from './BevelButton';
import '../styles/window.css';

export interface TitleBarProps {
  title: string;
  titleId?: string;
  /** When omitted, no close button is shown. */
  onClose?: () => void;
  /** When provided, a Minimize button is shown before Maximize and Close. */
  onMinimize?: () => void;
  /** When provided, a Maximize/Restore button is shown. */
  onToggleMaximize?: () => void;
  maximized?: boolean;
  /** Extra props for the bar itself, used by Window for dragging. */
  barProps?: HTMLAttributes<HTMLDivElement>;
}

/** Crisp 10x10 glyphs drawn with currentColor, so they follow the button text color. */
function Glyph({ kind }: { kind: 'minimize' | 'maximize' | 'restore' | 'close' }) {
  return (
    <svg
      className="window-glyph"
      viewBox="0 0 10 10"
      width={10}
      height={10}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'minimize' && <rect x={1} y={7} width={6} height={2} fill="currentColor" />}
      {kind === 'maximize' && (
        <>
          <rect x={0} y={0} width={10} height={2} fill="currentColor" />
          <rect x={0} y={2} width={1} height={8} fill="currentColor" />
          <rect x={9} y={2} width={1} height={8} fill="currentColor" />
          <rect x={0} y={9} width={10} height={1} fill="currentColor" />
        </>
      )}
      {kind === 'restore' && (
        <>
          <rect x={3} y={0} width={7} height={2} fill="currentColor" />
          <rect x={9} y={2} width={1} height={5} fill="currentColor" />
          <rect x={7} y={6} width={3} height={1} fill="currentColor" />
          <rect x={0} y={3} width={7} height={2} fill="currentColor" />
          <rect x={0} y={5} width={1} height={5} fill="currentColor" />
          <rect x={6} y={5} width={1} height={5} fill="currentColor" />
          <rect x={0} y={9} width={7} height={1} fill="currentColor" />
        </>
      )}
      {kind === 'close' && (
        <>
          <rect x={1} y={1} width={2} height={2} fill="currentColor" />
          <rect x={3} y={3} width={2} height={2} fill="currentColor" />
          <rect x={5} y={5} width={2} height={2} fill="currentColor" />
          <rect x={7} y={7} width={2} height={2} fill="currentColor" />
          <rect x={7} y={1} width={2} height={2} fill="currentColor" />
          <rect x={5} y={3} width={2} height={2} fill="currentColor" />
          <rect x={3} y={5} width={2} height={2} fill="currentColor" />
          <rect x={1} y={7} width={2} height={2} fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function TitleBar({
  title,
  titleId,
  onClose,
  onMinimize,
  onToggleMaximize,
  maximized = false,
  barProps,
}: TitleBarProps) {
  return (
    <div {...barProps} className="window-title-bar">
      <span id={titleId} className="window-title-text">
        {title}
      </span>
      <div className="window-controls">
        {onMinimize ? (
          <BevelButton className="window-ctrl" aria-label="Minimize" onClick={() => onMinimize()}>
            <Glyph kind="minimize" />
          </BevelButton>
        ) : null}
        {onToggleMaximize ? (
          <BevelButton
            className="window-ctrl"
            aria-label={maximized ? 'Restore' : 'Maximize'}
            onClick={() => onToggleMaximize()}
          >
            <Glyph kind={maximized ? 'restore' : 'maximize'} />
          </BevelButton>
        ) : null}
        {onClose ? (
          <BevelButton className="window-close window-ctrl" aria-label="Close" onClick={() => onClose()}>
            <Glyph kind="close" />
          </BevelButton>
        ) : null}
      </div>
    </div>
  );
}
