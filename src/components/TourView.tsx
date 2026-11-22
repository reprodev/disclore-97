import { useEffect, useMemo, useState } from 'react';
import { isMuted, playSlideClick, subscribeMuted } from '../audio/audio';
import { isSpeechAvailable, speak, stopSpeaking } from '../audio/speech';
import type { DiscManifest } from '../model/manifest';
import { buildTour } from '../model/tour';
import { BevelButton } from './BevelButton';
import { Plate } from './Plate';
import '../styles/tour.css';

export interface TourViewProps {
  disc: DiscManifest;
  /** Zero-based current stop, owned by the app so Back from an article returns to the same stop. */
  stop: number;
  onStop: (index: number) => void;
  /** Opens the full article of the current stop. */
  onOpenSection: (sectionId: string) => void;
}

/**
 * "Take a Tour": a 1997 presentation card for one article at a time. It shows a Stop X of Y
 * progress bar, the title, the picture or plate, a spotlight fact, and an optional dated event.
 */
export function TourView({ disc, stop, onStop, onOpenSection }: TourViewProps) {
  const stops = useMemo(() => buildTour(disc), [disc]);
  const total = stops.length;
  const at = Math.min(Math.max(stop, 0), Math.max(total - 1, 0));
  const current = stops[at];
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(isMuted);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const speechReady = isSpeechAvailable();

  useEffect(() => subscribeMuted(setMuted), []);

  // Narration belongs to one stop: it ends on a stop change and when the tour closes.
  useEffect(() => {
    setSpeaking(false);
    return () => stopSpeaking();
  }, [at]);

  if (!current) {
    return (
      <section className="tour" aria-label="Take a Tour">
        <h1 className="tour__title">Take a Tour</h1>
        <p className="tour__empty">This disc has no articles to tour.</p>
      </section>
    );
  }

  const go = (d: number) => {
    playSlideClick();
    onStop(Math.min(total - 1, Math.max(0, at + d)));
  };

  const toggleSpeech = () => {
    if (speaking) {
      stopSpeaking();
      return;
    }
    const texts = [current.title, current.spotlightFact, ...(current.timelineNote ? [current.timelineNote] : [])];
    setSpeaking(speak(texts, () => setSpeaking(false)));
  };

  const pictureFailed = current.media !== undefined && broken.has(current.media.url);
  const caption = current.media && !pictureFailed ? current.media.caption : `Plate: ${current.title}`;

  return (
    <section className="tour" aria-label="Take a Tour">
      <p className="tour__kicker">Take a Tour &bull; {disc.title}</p>
      <div
        className="tour__progress"
        role="progressbar"
        aria-label="Tour progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={at + 1}
        aria-valuetext={`Stop ${at + 1} of ${total}`}
      >
        <span className="tour__progress-fill" style={{ width: `${((at + 1) / total) * 100}%` }} />
      </div>
      <p className="tour__stop">
        Stop {at + 1} of {total}
      </p>
      <h1 className="tour__title">{current.title}</h1>
      <div className="tour__card">
        <figure className="tour__figure">
          {current.media && !pictureFailed ? (
            <img
              key={current.media.url}
              className="tour__img"
              src={current.media.url}
              alt={current.media.caption}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => {
                const url = current.media!.url;
                setBroken((b) => (b.has(url) ? b : new Set(b).add(url)));
              }}
            />
          ) : (
            <Plate kind={current.plate} caption={caption} />
          )}
          {current.media && !pictureFailed ? <figcaption className="tour__caption">{caption}</figcaption> : null}
        </figure>
        <div className="tour__notes">
          <h2 className="tour__heading">Spotlight</h2>
          <p className="tour__fact">{current.spotlightFact}</p>
          {current.timelineNote ? (
            <p className="tour__badge" aria-label={`Dated event: ${current.timelineNote}`}>
              {current.timelineNote}
            </p>
          ) : null}
        </div>
      </div>
      <div className="tour__buttons" role="group" aria-label="Tour controls">
        <BevelButton quiet disabled={at === 0} onClick={() => go(-1)}>
          Previous
        </BevelButton>
        <BevelButton quiet disabled={at >= total - 1} onClick={() => go(1)}>
          Next
        </BevelButton>
        <BevelButton
          className="article-tools__toggle"
          aria-pressed={speaking}
          disabled={!speechReady || (muted && !speaking)}
          title={!speechReady ? 'Narration is not available in this browser' : muted ? 'Sound is muted' : 'Read this stop aloud'}
          onClick={toggleSpeech}
        >
          {speaking ? 'Stop Reading' : 'Read Stop Aloud'}
        </BevelButton>
        <BevelButton onClick={() => onOpenSection(current.section_id)}>Open Full Article</BevelButton>
      </div>
    </section>
  );
}
