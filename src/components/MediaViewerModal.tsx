import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { MediaItem } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/article.css';

export interface MediaViewerModalProps {
  /** Disc or article title shown in the caption bar. */
  title: string;
  media: readonly MediaItem[];
  /** Zero-based index of the current frame, owned by the Multimedia Reel. */
  index: number;
  playing: boolean;
  /** Addresses that failed to load. They are drawn as the fallback plate. */
  broken: ReadonlySet<string>;
  /** Addresses that finished loading. */
  loaded: ReadonlySet<string>;
  fallback: (caption: string) => ReactNode;
  onStep: (delta: number) => void;
  onSelect: (index: number) => void;
  onTogglePlay: () => void;
  onLoad: (url: string) => void;
  onError: (url: string) => void;
  onClose: () => void;
}

/**
 * Win95 Picture Viewer: a modal window with the full-size picture on a sunken mat,
 * the full caption, Prev / Play-Pause / Next controls, and a thumbnail filmstrip.
 * ArrowLeft and ArrowRight step, Space toggles Play, and Escape closes.
 */
export function MediaViewerModal({
  title,
  media,
  index,
  playing,
  broken,
  loaded,
  fallback,
  onStep,
  onSelect,
  onTogglePlay,
  onLoad,
  onError,
  onClose,
}: MediaViewerModalProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, close, true);

  // Start on the picture itself so Space toggles Play instead of pressing the Close button.
  useEffect(() => {
    stageRef.current?.focus();
  }, []);

  const count = media.length;
  const at = Math.min(index, count - 1);
  const item = media[at];
  if (!item) return null;
  const failed = broken.has(item.url);
  const loading = !failed && !loaded.has(item.url);
  const multi = count > 1;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (!multi) return;
      e.preventDefault();
      onStep(e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    // A focused button keeps its own Space behavior.
    if (e.key === ' ' && multi && !(e.target as HTMLElement).closest('button')) {
      e.preventDefault();
      onTogglePlay();
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
            <BevelButton className="media-reel__button" onClick={() => onStep(-1)} disabled={!multi}>
              Prev
            </BevelButton>
            <BevelButton
              className="media-reel__button article-tools__toggle"
              aria-pressed={playing}
              onClick={onTogglePlay}
              disabled={!multi}
            >
              {playing ? 'Pause' : 'Play'}
            </BevelButton>
            <BevelButton className="media-reel__button" onClick={() => onStep(1)} disabled={!multi}>
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
                    onClick={() => onSelect(i)}
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
        </div>
      </Window>
    </div>,
    host,
  );
}
