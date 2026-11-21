import { useEffect, useRef } from 'react';
import { playPageFlip } from '../audio/audio';
import type { Section } from '../model/manifest';
import { relatedSections } from '../model/topics';
import { Plate } from './Plate';
import '../styles/article.css';

export interface ArticleViewerProps {
  sections: Section[];
  /** Currently selected section id. */
  sectionId: string;
  /** Opens another section. When omitted, the See Also strip is not shown. */
  onSelectSection?: (sectionId: string) => void;
}

export function ArticleViewer({ sections, sectionId, onSelectSection }: ArticleViewerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const section = sections.find((s) => s.section_id === sectionId);
  const found = section !== undefined;

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
    if (found) playPageFlip();
  }, [sectionId, found]);

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

  return (
    <article ref={ref} className="article-viewer">
      <h1 className="article-title">{section.title}</h1>
      <aside className="article-aside">
        <Plate kind={section.plate} caption={`Plate: ${section.title}`} />
        {facts.length > 0 || timeline.length > 0 ? (
          <div className="article-callout">
            {facts.length > 0 ? (
              <section aria-label="Quick Facts">
                <h2 className="article-callout__title">Quick Facts</h2>
                <ul className="article-callout__list">
                  {facts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {timeline.length > 0 ? (
              <section aria-label="Timeline">
                <h2 className="article-callout__title">Timeline</h2>
                <dl className="article-timeline">
                  {timeline.map((t, i) => (
                    <div key={i} className="article-timeline__row">
                      <dt>{t.when}</dt>
                      <dd>{t.event}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>
        ) : null}
      </aside>
      {section.paragraphs.map((p, i) => (
        <p key={i} className={i === 0 ? 'article-paragraph article-paragraph--lead' : 'article-paragraph'}>
          {p}
        </p>
      ))}
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
    </article>
  );
}
