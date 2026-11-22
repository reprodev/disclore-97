import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { MediaItem } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { MediaViewerModal } from './MediaViewerModal';
import '../styles/article.css';

export const REEL_INTERVAL_MS = 4000;

export interface MediaReelProps {
  media: readonly MediaItem[];
  /** Drawn in place of a picture that fails to load. */
  fallback: (caption: string) => ReactNode;
  /** Auto-advance delay while playing. */
  intervalMs?: number;
  /** Shown in the Picture Viewer caption bar. */
  title?: string;
}

/**
 * A beveled picture frame with a caption and a Multimedia Reel control bar:
 * Prev, Play / Pause (auto-advances), Next, Enlarge, and a Frame X / Y counter.
 * Pictures load with no referrer and lazily, with a "Loading picture..." note until they
 * arrive. A broken picture shows `fallback`. Clicking the picture, or Enlarge, opens the
 * Picture Viewer, which shares this reel's frame and Play state.
 */
export function MediaReel({ media, fallback, intervalMs = REEL_INTERVAL_MS, title = 'Multimedia Reel' }: MediaReelProps) {
  const count = media.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());

  // A different disc brings a different reel: start over.
  const signature = media.map((m) => m.url).join('\n');
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    setViewerOpen(false);
    setBroken(new Set());
    setLoaded(new Set());
  }, [signature]);

  useEffect(() => {
    if (!playing || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearInterval(id);
  }, [playing, count, intervalMs]);

  if (count === 0) return null;
  const at = Math.min(index, count - 1);
  const item = media[at];
  const failed = broken.has(item.url);
  const loading = !failed && !loaded.has(item.url);

  const step = (d: number) => setIndex((i) => (Math.min(i, count - 1) + d + count) % count);
  const markBroken = (url: string) => setBroken((b) => (b.has(url) ? b : new Set(b).add(url)));
  const markLoaded = (url: string) => setLoaded((l) => (l.has(url) ? l : new Set(l).add(url)));
  const togglePlay = () => setPlaying((p) => !p);

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
            onClick={() => setViewerOpen(true)}
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
        <BevelButton className="media-reel__button" onClick={() => step(-1)} disabled={count < 2}>
          Prev
        </BevelButton>
        <BevelButton
          className="media-reel__button article-tools__toggle"
          aria-pressed={playing}
          onClick={togglePlay}
          disabled={count < 2}
        >
          {playing ? 'Pause' : 'Play'}
        </BevelButton>
        <BevelButton className="media-reel__button" onClick={() => step(1)} disabled={count < 2}>
          Next
        </BevelButton>
        <BevelButton className="media-reel__button" onClick={() => setViewerOpen(true)}>
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
          playing={playing}
          broken={broken}
          loaded={loaded}
          fallback={fallback}
          onStep={step}
          onSelect={setIndex}
          onTogglePlay={togglePlay}
          onLoad={markLoaded}
          onError={markBroken}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </figure>
  );
}
