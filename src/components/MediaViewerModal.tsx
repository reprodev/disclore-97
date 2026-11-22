import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { playSlideClick } from '../audio/audio';
import type { MediaItem } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/article.css';

export const SLIDESHOW_INTERVAL_MS = 4000;
export const VIEWER_HINT = 'Space: Play \u2022 \u2190/\u2192: Step \u2022 Esc: Close';

export interface MediaViewerModalProps {
  /** Disc or article title shown in the caption bar. */
  title: string;
  media: readonly MediaItem[];
  /** Zero-based index of the current frame, owned by the Multimedia Reel. */
  index: number;
  /** Addresses that failed to load. They are drawn as the fallback plate. */
  broken: ReadonlySet<string>;
  /** Addresses that finished loading. */
  loaded: ReadonlySet<string>;
  fallback: (caption: string) => ReactNode;
  onStep: (delta: number) => void;
  onSelect: (index: number) => void;
  onLoad: (url: string) => void;
  onError: (url: string) => void;
  onClose: () => void;
  /** Slideshow delay while playing. */
  intervalMs?: number;
}

/**
 * Win95 Picture Viewer: a modal window with the full-size picture on a sunken mat,
 * the full caption, Prev / Play-Pause / Next controls, and a thumbnail filmstrip.
 * This is the only place the slideshow plays. It starts paused and stops when the window
 * closes. ArrowLeft and ArrowRight step, Space toggles Play, and Escape closes.
 */
export function MediaViewerModal({
  title,
  media,
  index,
  broken,
  loaded,
  fallback,
  onStep,
  onSelect,
  onLoad,
  onError,
  onClose,
  intervalMs = SLIDESHOW_INTERVAL_MS,
}: MediaViewerModalProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const close = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, close, true);

  const count = media.length;
  const multi = count > 1;

  // Start on the picture itself so Space toggles Play instead of pressing the Close button.
  useEffect(() => {
    stageRef.current?.focus();
  }, []);

  // The slideshow lives only here: the timer ends with the window, so closing always pauses.
  useEffect(() => {
    if (!playing || !multi) return;
    const id = window.setInterval(() => stepRef.current(1), intervalMs);
    return () => window.clearInterval(id);
  }, [playing, multi, intervalMs]);

  const at = Math.min(index, count - 1);
  const item = media[at];
  if (!item) return null;
  const failed = broken.has(item.url);
  const loading = !failed && !loaded.has(item.url);

  /** A hand-made step gets the slide-projector click. Slideshow steps stay quiet. */
  const stepBy = (d: number) => {
    playSlideClick();
    onStep(d);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (!multi) return;
      e.preventDefault();
      stepBy(e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    // A focused button keeps its own Space behavior.
    if (e.key === ' ' && multi && !(e.target as HTMLElement).closest('button')) {
      e.preventDefault();
      setPlaying((p) => !p);
    }
  };

  const host = document.querySelector('.desktop__work') ?? document.body;

  return createPortal(
    <div ref={layerRef} className="modal-layer" onKeyDown={onKeyDown}>
      <Window title={`Picture Viewer \u2014 ${title}`} className="picture-viewer" modal onClose={close}>
        <div className="picture-viewer__body">
          <div
            ref={stageRef}
            className="picture-viewer__mat"
            tabIndex={-1}
            role="group"
            aria-label="Picture"
          >
            {failed ? (
              <div className="picture-viewer__fallback">{fallback(item.caption)}</div>
            ) : (
              <img
                key={item.url}
                className="picture-viewer__img"
                src={item.url}
                alt={item.caption}
                referrerPolicy="no-referrer"
                onLoad={() => onLoad(item.url)}
                onError={() => onError(item.url)}
              />
            )}
            {loading ? (
              <span className="media-loading" role="status">
                Loading picture...
              </span>
            ) : null}
          </div>
          <p className="picture-viewer__caption">{item.caption}</p>

          <div className="media-reel picture-viewer__controls" role="group" aria-label="Picture Viewer controls">
            <BevelButton className="media-reel__button" quiet onClick={() => stepBy(-1)} disabled={!multi}>
              Prev
            </BevelButton>
            <BevelButton
              className="media-reel__button article-tools__toggle"
              aria-pressed={playing}
              onClick={() => setPlaying((p) => !p)}
              disabled={!multi}
            >
              {playing ? 'Pause' : 'Play'}
            </BevelButton>
            <BevelButton className="media-reel__button" quiet onClick={() => stepBy(1)} disabled={!multi}>
              Next
            </BevelButton>
            <span className="media-reel__counter">
              Frame {at + 1} / {count}
            </span>
          </div>

          {multi ? (
            <ul className="picture-viewer__strip" aria-label="Thumbnails">
              {media.map((m, i) => (
                <li key={m.url}>
                  <button
                    type="button"
                    className="picture-viewer__thumb"
                    data-active={i === at ? 'true' : 'false'}
                    aria-label={`Frame ${i + 1}: ${m.caption}`}
                    aria-current={i === at ? 'true' : undefined}
                    onClick={() => {
                      playSlideClick();
                      onSelect(i);
                    }}
                  >
                    {broken.has(m.url) ? (
                      <span className="picture-viewer__thumb-miss" aria-hidden="true">
                        {i + 1}
                      </span>
                    ) : (
                      <img
                        src={m.url}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={() => onError(m.url)}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="picture-viewer__hint">{VIEWER_HINT}</p>
        </div>
      </Window>
    </div>,
    host,
  );
}
