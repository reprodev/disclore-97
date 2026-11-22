import { useEffect, useRef, useState } from 'react';
import { isMuted, playPageFlip, subscribeMuted } from '../audio/audio';
import { isSpeechAvailable, speak, stopSpeaking } from '../audio/speech';
import type { Diagram, MediaItem, Section } from '../model/manifest';
import { relatedSections } from '../model/topics';
import { BevelButton } from './BevelButton';
import { CiteDialog } from './CiteDialog';
import { MediaReel } from './MediaReel';
import { Plate } from './Plate';
import '../styles/article.css';

export interface ArticleViewerProps {
  sections: Section[];
  /** Currently selected section id. */
  sectionId: string;
  /** Opens another section. When omitted, the See Also strip is not shown. */
  onSelectSection?: (sectionId: string) => void;
  /** Title of the open disc. When given, the Cite / Print Preview button is shown. */
  discTitle?: string;
  /** Diagrams of the open disc. With onShowInDiagram, enables the Show in Diagram button. */
  diagrams?: Diagram[];
  /** Opens a diagram with the hotspot for the active section highlighted. */
  onShowInDiagram?: (diagramId: string, sectionId: string) => void;
  /** Pictures of the open disc. When non-empty, the Media Frame and Multimedia Reel replace the plate. */
  media?: MediaItem[];
}

export function ArticleViewer({
  sections,
  sectionId,
  onSelectSection,
  discTitle,
  diagrams,
  onShowInDiagram,
  media,
}: ArticleViewerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [citeOpen, setCiteOpen] = useState(false);
  /** Narration progress, 1-based paragraph number out of the total. Null when not speaking. */
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const speaking = progress !== null;
  /** Reading speed: normal, or brisk. */
  const [rate, setRate] = useState<1 | 1.2>(1);
  const [muted, setMuted] = useState(isMuted);
  const section = sections.find((s) => s.section_id === sectionId);
  const found = section !== undefined;

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
    if (found) playPageFlip();
  }, [sectionId, found]);

  // Narration belongs to one article: it stops on a section change and on unmount.
  useEffect(() => {
    setProgress(null);
    return () => stopSpeaking();
  }, [sectionId]);

  // Keep the paragraph being read in view.
  const speakingAt = progress?.current ?? 0;
  useEffect(() => {
    if (speakingAt === 0) return;
    const el = ref.current?.querySelector<HTMLElement>('[data-speaking="true"]');
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [speakingAt]);

  // Mute stops speech itself (see speech.ts). This only keeps the button in step.
  useEffect(() => subscribeMuted(setMuted), []);

  // A dialog for the previous article must not stay open on the next one.
  useEffect(() => {
    setCiteOpen(false);
  }, [sectionId]);

  if (!section) {
    return (
      <article ref={ref} className="article-viewer" role="alert">
        <p className="article-not-found">Section not found: {sectionId}</p>
      </article>
    );
  }

  const related = onSelectSection ? relatedSections(sections, sectionId) : [];
  const facts = section.facts ?? [];
  const timeline = section.timeline ?? [];
  const diagramLink = onShowInDiagram
    ? (diagrams ?? []).find((d) => d.hotspots.some((h) => h.section_id === sectionId))
    : undefined;
  const canCite = discTitle !== undefined;
  const reel = media ?? [];
  const speechReady = isSpeechAvailable();

  /** Narrates the title and paragraphs from item rom (0 is the title). Progress counts the whole list. */
  const startSpeech = (from: number, speed: number) => {
    const texts = [section.title, ...section.paragraphs];
    speak(
      texts.slice(from),
      () => setProgress(null),
      (current, total) => setProgress({ current: current + from, total: total + from }),
      speed,
    );
  };

  const toggleSpeech = () => {
    if (speaking) {
      stopSpeaking();
      return;
    }
    startSpeech(0, rate);
  };

  /** Switches between 1x and 1.2x. While narrating, it carries on from the current paragraph at the new speed. */
  const toggleRate = () => {
    const next = rate === 1 ? 1.2 : 1;
    setRate(next);
    if (progress) startSpeech(progress.current - 1, next);
  };

  return (
    <article ref={ref} className="article-viewer">
      <h1 className={progress?.current === 1 ? 'article-title article-title--speaking' : 'article-title'} data-speaking={progress?.current === 1 ? 'true' : undefined}>
        {section.title}
      </h1>
      <div className="article-tools" role="group" aria-label="Article tools">
        {diagramLink ? (
          <BevelButton onClick={() => onShowInDiagram?.(diagramLink.diagram_id, sectionId)}>
            Show in Diagram
          </BevelButton>
        ) : null}
        {canCite ? <BevelButton onClick={() => setCiteOpen(true)}>Cite / Print Preview</BevelButton> : null}
        <BevelButton
          className="article-tools__toggle"
          aria-pressed={speaking}
          disabled={!speechReady || (muted && !speaking)}
          title={
            !speechReady
              ? 'Narration is not available in this browser'
              : muted
                ? 'Sound is muted'
                : 'Read this article aloud'
          }
          onClick={toggleSpeech}
        >
          {progress ? `Stop (${progress.current}/${progress.total})` : 'Read Aloud'}
        </BevelButton>
        <BevelButton
          className="article-tools__rate"
          disabled={!speechReady}
          title={`Reading speed: ${rate === 1 ? 'normal' : 'brisk'}. Click to change.`}
          onClick={toggleRate}
        >
          {rate === 1 ? '1x' : '1.2x'}
        </BevelButton>
      </div>
      <aside className="article-aside">
        {reel.length > 0 ? (
          <MediaReel
            media={reel}
            title={discTitle ?? section.title}
            fallback={(caption) => <Plate kind={section.plate} caption={caption} />}
          />
        ) : (
          <Plate kind={section.plate} caption={`Plate: ${section.title}`} />
        )}
        {facts.length > 0 ? (
          <div className="article-callout">
            <section aria-label="Quick Facts">
              <h2 className="article-callout__title">Quick Facts</h2>
              <ul className="article-callout__list">
                {facts.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </aside>
      {section.paragraphs.map((p, i) => (
        <p
          key={i}
          className={[
            'article-paragraph',
            i === 0 ? 'article-paragraph--lead' : '',
            progress?.current === i + 2 ? 'article-paragraph--speaking' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-speaking={progress?.current === i + 2 ? 'true' : undefined}
          aria-current={progress?.current === i + 2 ? 'true' : undefined}
        >
          {p}
        </p>
      ))}
      {timeline.length > 0 ? (
        <section className="article-chrono" aria-label="Chronology">
          <h2 className="article-chrono__title">Chronology</h2>
          <ol className="article-chrono__strip">
            {timeline.map((t, i) => (
              <li key={i} className="article-chrono__stop">
                <span className="article-chrono__when">{t.when}</span>
                <span className="article-chrono__tick" aria-hidden="true" />
                <span className="article-chrono__event">{t.event}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {onSelectSection && related.length > 0 ? (
        <nav className="article-seealso" aria-label="See Also">
          <h2 className="article-seealso__title">See Also</h2>
          <ul className="article-seealso__list">
            {related.map((r) => (
              <li key={r.section_id}>
                <a
                  href={`#${r.section_id}`}
                  className="article-seealso__link"
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectSection(r.section_id);
                  }}
                >
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {citeOpen && discTitle !== undefined ? (
        <CiteDialog section={section} discTitle={discTitle} onClose={() => setCiteOpen(false)} />
      ) : null}
    </article>
  );
}
