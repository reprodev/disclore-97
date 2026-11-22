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
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(isMuted);
  const section = sections.find((s) => s.section_id === sectionId);
  const found = section !== undefined;

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
    if (found) playPageFlip();
  }, [sectionId, found]);

  // Narration belongs to one article: it stops on a section change and on unmount.
  useEffect(() => {
    setSpeaking(false);
    return () => stopSpeaking();
  }, [sectionId]);

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

  const toggleSpeech = () => {
    if (speaking) {
      stopSpeaking();
      return;
    }
    if (speak([section.title, ...section.paragraphs], () => setSpeaking(false))) setSpeaking(true);
  };

  return (
    <article ref={ref} className="article-viewer">
      <h1 className="article-title">{section.title}</h1>
      <div className="article-tools" role="group" aria-label="Article tools">
        {diagramLink ? (
          <BevelButton onClick={() => onShowInDiagram?.(diagramLink.diagram_id, sectionId)}>
            Show in Diagram
          </BevelButton>
        ) : null}
        {canCite ? <BevelButton onClick={() => setCiteOpen(true)}>Cite / Print Preview</BevelButton> : null}
        <BevelButton
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
          {speaking ? 'Stop' : 'Read Aloud'}
        </BevelButton>
      </div>
      <aside className="article-aside">
        {reel.length > 0 ? (
          <MediaReel
            media={reel}
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
        <p key={i} className={i === 0 ? 'article-paragraph article-paragraph--lead' : 'article-paragraph'}>
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
