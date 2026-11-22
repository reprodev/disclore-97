import { useId, useState } from 'react';
import type { DiscManifest } from '../model/manifest';
import type { View } from '../model/nav';
import { filterSections } from '../model/topics';
import { BevelButton } from './BevelButton';
import { PixelIcon } from './PixelIcon';
import '../styles/browser.css';

export interface ContentsSidebarProps {
  disc: DiscManifest;
  /** Current view, used to highlight the active item. */
  view: View | null;
  onSelectSection: (sectionId: string) => void;
  onSelectDiagram: (diagramId: string) => void;
  onSelectDungeon: (dungeonId: string) => void;
}

/** Persistent contents tree with a live "Find in Disc..." filter over sections. */
export function ContentsSidebar({
  disc,
  view,
  onSelectSection,
  onSelectDiagram,
  onSelectDungeon,
}: ContentsSidebarProps) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const shown = filterSections(disc.sections, query);
  const filtering = query.trim() !== '';

  const activeSection = view?.kind === 'section' ? view.section_id : null;
  const activeDiagram = view?.kind === 'diagram' ? view.diagram_id : null;
  const activeDungeon = view?.kind === 'keepmaze' ? view.dungeon_id : null;

  const entryClass = (active: boolean) => (active ? 'disc-entry disc-entry--active' : 'disc-entry');

  return (
    <nav className="disc-tree" aria-label={disc.title}>
      <div className="disc-find">
        <label className="disc-find__label" htmlFor={inputId}>
          Find in Disc...
        </label>
        <input
          id={inputId}
          className="disc-find__input"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtering ? (
          <p className="disc-find__count">
            {shown.length} of {disc.sections.length} sections
          </p>
        ) : null}
      </div>

      <section className="disc-group">
        <h2 className="disc-group-title">
          <PixelIcon name="book" />
          Sections
        </h2>
        <ul>
          {shown.map((s) => (
            <li key={s.section_id}>
              <BevelButton
                className={entryClass(s.section_id === activeSection)}
                aria-current={s.section_id === activeSection ? 'page' : undefined}
                onClick={() => onSelectSection(s.section_id)}
              >
                <PixelIcon name="book" />
                <span>{s.title}</span>
              </BevelButton>
            </li>
          ))}
        </ul>
        {filtering && shown.length === 0 ? <p className="disc-find__empty">No sections match.</p> : null}
      </section>

      <section className="disc-group">
        <h2 className="disc-group-title">
          <PixelIcon name="diagram" />
          Diagrams
        </h2>
        <ul>
          {disc.diagrams.map((d) => (
            <li key={d.diagram_id}>
              <BevelButton
                className={entryClass(d.diagram_id === activeDiagram)}
                aria-current={d.diagram_id === activeDiagram ? 'page' : undefined}
                onClick={() => onSelectDiagram(d.diagram_id)}
              >
                <PixelIcon name="diagram" />
                <span>{d.title}</span>
              </BevelButton>
            </li>
          ))}
        </ul>
      </section>

      <section className="disc-group">
        <h2 className="disc-group-title">
          <PixelIcon name="key" />
          Trivia
        </h2>
        <ul className="disc-trivia-bank">
          {disc.trivia.map((q) => (
            <li key={q.question_id} className="disc-trivia-item">
              {q.prompt}
            </li>
          ))}
        </ul>
      </section>

      <section className="disc-group">
        <h2 className="disc-group-title">
          <PixelIcon name="torch" />
          Dungeons
        </h2>
        <ul>
          {disc.dungeons.map((d) => (
            <li key={d.dungeon_id}>
              <BevelButton
                className={entryClass(d.dungeon_id === activeDungeon)}
                aria-current={d.dungeon_id === activeDungeon ? 'page' : undefined}
                onClick={() => onSelectDungeon(d.dungeon_id)}
              >
                <PixelIcon name="torch" />
                <span>{d.title}</span>
              </BevelButton>
            </li>
          ))}
        </ul>
      </section>
    </nav>
  );
}
