import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { playSlideClick } from '../audio/audio';
import type { MediaItem } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { MediaViewerModal, SLIDESHOW_INTERVAL_MS } from './MediaViewerModal';
import '../styles/article.css';

export const REEL_INTERVAL_MS = SLIDESHOW_INTERVAL_MS;

export interface MediaReelProps {
  media: readonly MediaItem[];
  /** Drawn in place of a picture that fails to load. */
  fallback: (caption: string) => ReactNode;
  /** Slideshow delay in the Picture Viewer. */
  intervalMs?: number;
  /** Shown in the Picture Viewer caption bar. */
  title?: string;
}

/**
 * A beveled picture frame with a caption and a compact Multimedia Reel control bar:
 * Prev, Next, Enlarge, and a Frame X / Y counter. Pictures load with no referrer and
 * lazily, with a "Loading picture..." note until they arrive. A broken picture shows
 * `fallback`. Clicking the picture, or Enlarge, opens the Picture Viewer, which shares
 * this reel's frame and is the only place the slideshow plays.
 */
export function MediaReel({ media, fallback, intervalMs = REEL_INTERVAL_MS, title = 'Multimedia Reel' }: MediaReelProps) {
  const count = media.length;
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());

  // A different disc brings a different reel: start over.
  const signature = media.map((m) => m.url).join('\n');
  useEffect(() => {
    setIndex(0);
    setViewerOpen(false);
    setBroken(new Set());
    setLoaded(new Set());
  }, [signature]);

  /** Silent step, also used by the slideshow. Manual buttons add the projector click themselves. */
  const step = useCallback(
    (d: number) => setIndex((i) => (Math.min(i, Math.max(count - 1, 0)) + d + count) % Math.max(count, 1)),
    [count],
  );

  if (count === 0) return null;
  const at = Math.min(index, count - 1);
  const item = media[at];
  const failed = broken.has(item.url);
  const loading = !failed && !loaded.has(item.url);

  const markBroken = (url: string) => setBroken((b) => (b.has(url) ? b : new Set(b).add(url)));
  const markLoaded = (url: string) => setLoaded((l) => (l.has(url) ? l : new Set(l).add(url)));
  const enlarge = () => {
    playSlideClick();
    setViewerOpen(true);
  };
  const manualStep = (d: number) => {
    playSlideClick();
    step(d);
  };

  return (
    <figure className="media-frame" aria-label="Multimedia Reel">
      <div className="media-frame__mat">
        {failed ? (
          fallback(item.caption)
        ) : (
          <button
            type="button"
            className="media-frame__zoom"
            aria-label={`View larger: ${item.caption}`}
            onClick={enlarge}
          >
            <img
              key={item.url}
              className="media-frame__img"
              src={item.url}
              alt={item.caption}
              referrerPolicy="no-referrer"
              loading="lazy"
              onLoad={() => markLoaded(item.url)}
              onError={() => markBroken(item.url)}
            />
          </button>
        )}
        {loading ? (
          <span className="media-loading" role="status">
            Loading picture...
          </span>
        ) : null}
      </div>
      <figcaption className="media-frame__caption">{item.caption}</figcaption>
      <div className="media-reel" role="group" aria-label="Multimedia Reel controls">
        <BevelButton className="media-reel__button" quiet onClick={() => manualStep(-1)} disabled={count < 2}>
          Prev
        </BevelButton>
        <BevelButton className="media-reel__button" quiet onClick={() => manualStep(1)} disabled={count < 2}>
          Next
        </BevelButton>
        <BevelButton className="media-reel__button" quiet onClick={enlarge}>
          Enlarge
        </BevelButton>
        <span className="media-reel__counter">
          Frame {at + 1} / {count}
        </span>
      </div>
      {viewerOpen ? (
        <MediaViewerModal
          title={title}
          media={media}
          index={at}
          broken={broken}
          loaded={loaded}
          fallback={fallback}
          intervalMs={intervalMs}
          onStep={step}
          onSelect={setIndex}
          onLoad={markLoaded}
          onError={markBroken}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </figure>
  );
}
