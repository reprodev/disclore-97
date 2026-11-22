import { useEffect, useMemo, useRef, useState } from 'react';
import { isMuted, playSlideClick, subscribeMuted } from '../audio/audio';
import { isSpeechAvailable, speak, stopSpeaking } from '../audio/speech';
import type { DiscManifest } from '../model/manifest';
import { buildTour } from '../model/tour';
import { BevelButton } from './BevelButton';
import { Plate } from './Plate';
import '../styles/tour.css';

/** How long each stop stays up in a silent Media Show. */
export const SHOW_INTERVAL_MS = 5000;

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
 *
 * Play Show is the Media Show (Look and Listen): each stop is narrated with the browser's voice and the tour
 * moves on when the narration ends. Muted, or with no speech, each stop stays for SHOW_INTERVAL_MS. The show
 * ends at the last stop, and stops on Pause, Mute, Previous, Next, a new article, or when the tour closes.
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
  const [playing, setPlaying] = useState(false);
  /** The latest playing, and whether the tour is still on screen. Narration callbacks read them, because they may fire during a cleanup. */
  const playingRef = useRef(false);
  playingRef.current = playing;
  const aliveRef = useRef(true);
  // Declared first so its cleanup runs first when the tour closes.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => subscribeMuted(setMuted), []);

  // Narration belongs to one stop: it ends on a stop change and when the tour closes.
  useEffect(() => {
    setSpeaking(false);
    return () => stopSpeaking();
  }, [at]);

  // The Media Show: narrate this stop (or wait on a timer), then move to the next one.
  const lastIndex = total - 1;
  useEffect(() => {
    if (!playing || !current) return;
    let cancelled = false;
    const advance = () => {
      if (cancelled || !playingRef.current || !aliveRef.current) return;
      if (at >= lastIndex) setPlaying(false);
      else onStop(at + 1);
    };
    if (speechReady && !isMuted()) {
      const texts = [current.title, current.spotlightFact, ...(current.timelineNote ? [current.timelineNote] : [])];
      const started = speak(texts, () => {
        if (cancelled || !playingRef.current || !aliveRef.current) return;
        // Mute silences the voice and ends it early: that is a pause, not the end of the stop.
        if (isMuted()) setPlaying(false);
        else advance();
      });
      if (started) {
        return () => {
          cancelled = true;
          stopSpeaking();
        };
      }
    }
    const timer = window.setTimeout(advance, SHOW_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // The stop's text is fixed by its index, so the index is the only thing that restarts a stop.
  }, [playing, at]);

  if (!current) {
    return (
      <section className="tour" aria-label="Take a Tour">
        <h1 className="tour__title">Take a Tour</h1>
        <p className="tour__empty">This disc has no articles to tour.</p>
      </section>
    );
  }

  const go = (d: number) => {
    setPlaying(false);
    playSlideClick();
    onStop(Math.min(total - 1, Math.max(0, at + d)));
  };

  const toggleShow = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // Starting again from the last stop wraps back to the first.
    if (at >= lastIndex && total > 1) onStop(0);
    setPlaying(true);
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
        <BevelButton className="article-tools__toggle" aria-pressed={playing} onClick={toggleShow}>
          {playing ? 'Pause Show' : 'Play Show'}
        </BevelButton>
        <BevelButton quiet disabled={at === 0} onClick={() => go(-1)}>
          Previous
        </BevelButton>
        <BevelButton quiet disabled={at >= total - 1} onClick={() => go(1)}>
          Next
        </BevelButton>
        <BevelButton
          className="article-tools__toggle"
          aria-pressed={speaking}
          disabled={playing || !speechReady || (muted && !speaking)}
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
