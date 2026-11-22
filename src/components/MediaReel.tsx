import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { MediaItem } from '../model/manifest';
import { BevelButton } from './BevelButton';
import '../styles/article.css';

export const REEL_INTERVAL_MS = 4000;

export interface MediaReelProps {
  media: readonly MediaItem[];
  /** Drawn in place of a picture that fails to load. */
  fallback: (caption: string) => ReactNode;
  /** Auto-advance delay while playing. */
  intervalMs?: number;
}

/**
 * A beveled picture frame with a caption and a Multimedia Reel control bar:
 * Prev, Play / Pause (auto-advances), Next, and a Frame X / Y counter.
 * Pictures load with no referrer and lazily. A broken picture shows `fallback`.
 */
export function MediaReel({ media, fallback, intervalMs = REEL_INTERVAL_MS }: MediaReelProps) {
  const count = media.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());

  // A different disc brings a different reel: start over.
  const signature = media.map((m) => m.url).join('\n');
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    setBroken(new Set());
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

  const step = (d: number) => setIndex((i) => (Math.min(i, count - 1) + d + count) % count);

  return (
    <figure className="media-frame" aria-label="Multimedia Reel">
      <div className="media-frame__mat">
        {failed ? (
          fallback(item.caption)
        ) : (
          <img
            key={item.url}
            className="media-frame__img"
            src={item.url}
            alt={item.caption}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setBroken((b) => new Set(b).add(item.url))}
          />
        )}
      </div>
      <figcaption className="media-frame__caption">{item.caption}</figcaption>
      <div className="media-reel" role="group" aria-label="Multimedia Reel controls">
        <BevelButton className="media-reel__button" onClick={() => step(-1)} disabled={count < 2}>
          Prev
        </BevelButton>
        <BevelButton
          className="media-reel__button"
          aria-pressed={playing}
          onClick={() => setPlaying((p) => !p)}
          disabled={count < 2}
        >
          {playing ? 'Pause' : 'Play'}
        </BevelButton>
        <BevelButton className="media-reel__button" onClick={() => step(1)} disabled={count < 2}>
          Next
        </BevelButton>
        <span className="media-reel__counter">
          Frame {at + 1} / {count}
        </span>
      </div>
    </figure>
  );
}
