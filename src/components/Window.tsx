import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { TitleBar } from './TitleBar';
import '../styles/window.css';

export interface WindowProps {
  title: string;
  /** When omitted, the title bar has no close button. */
  onClose?: () => void;
  /** When provided, the title bar has a Minimize button. The parent owns the `minimized` state. */
  onMinimize?: () => void;
  /** Hides the window without unmounting it, so its state is kept. */
  minimized?: boolean;
  /** Adds a Maximize/Restore button. The window then fills the workspace when maximized. */
  maximizable?: boolean;
  /** Starts maximized. Only meaningful with maximizable. The user can still restore it. */
  defaultMaximized?: boolean;
  /** Lets the user drag the window by its title bar (not while maximized). */
  draggable?: boolean;
  /** Marks the dialog as modal for assistive technology. The parent blocks the content behind it. */
  modal?: boolean;
  menuBar?: ReactNode;
  children?: ReactNode;
  className?: string;
}

interface DragState {
  px: number;
  py: number;
  ox: number;
  oy: number;
  minDx: number;
  maxDx: number;
  minDy: number;
  maxDy: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));

export function Window({
  title,
  onClose,
  onMinimize,
  minimized = false,
  maximizable = false,
  defaultMaximized = false,
  draggable = false,
  modal = false,
  menuBar,
  children,
  className,
}: WindowProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<DragState | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [maximized, setMaximized] = useState(maximizable && defaultMaximized);
  const canDrag = draggable && !maximized;

  // A resized viewport could strand a dragged window, so return it to center.
  useEffect(() => {
    const reset = () => setOffset({ x: 0, y: 0 });
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canDrag || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const area = (root.closest('.desktop__work') ?? document.documentElement).getBoundingClientRect();
    drag.current = {
      px: e.clientX,
      py: e.clientY,
      ox: offset.x,
      oy: offset.y,
      minDx: area.left - rect.left,
      maxDx: area.right - rect.right,
      minDy: area.top - rect.top,
      maxDy: area.bottom - rect.bottom,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setOffset({
      x: d.ox + clamp(e.clientX - d.px, d.minDx, d.maxDx),
      y: d.oy + clamp(e.clientY - d.py, d.minDy, d.maxDy),
    });
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const toggleMaximize = () => setMaximized((m) => !m);

  const classes = ['window'];
  if (className) classes.push(className);
  if (maximized) classes.push('window--maximized');
  if (canDrag) classes.push('window--draggable');

  const moved = !maximized && (offset.x !== 0 || offset.y !== 0);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal={modal || undefined}
      className={classes.join(' ')}
      hidden={minimized}
      style={moved ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
    >
      <TitleBar
        title={title}
        titleId={titleId}
        onClose={onClose}
        onMinimize={onMinimize}
        onToggleMaximize={maximizable ? toggleMaximize : undefined}
        maximized={maximized}
        barProps={{
          onPointerDown,
          onPointerMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          onDoubleClick: (e) => {
            if (maximizable && !(e.target as HTMLElement).closest('button')) toggleMaximize();
          },
        }}
      />
      {menuBar ? <div className="window-menubar">{menuBar}</div> : null}
      <div className="window-content">{children}</div>
    </div>
  );
}
