import { useEffect, useRef } from 'react';
import { playPageFlip } from '../audio/audio';
import type { Section } from '../model/manifest';
import '../styles/article.css';

export interface ArticleViewerProps {
  sections: Section[];
  /** Currently selected section id. */
  sectionId: string;
}

export function ArticleViewer({ sections, sectionId }: ArticleViewerProps) {
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

  return (
    <article ref={ref} className="article-viewer">
      <h1 className="article-title">{section.title}</h1>
      {section.paragraphs.map((p, i) => (
        <p key={i} className="article-paragraph">
          {p}
        </p>
      ))}
    </article>
  );
}
