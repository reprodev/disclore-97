import { useMemo } from 'react';
import type { DiscManifest } from '../model/manifest';
import { collectTimeline } from '../model/timeline';
import '../styles/timeline.css';

export interface TimelineViewProps {
  disc: DiscManifest;
  /** Opens the article an event came from. */
  onSelectSection: (sectionId: string) => void;
}

/**
 * Explore History: every dated event from every article of the open disc, oldest first, as a
 * horizontal strip of century columns. Each event shows the article it came from as a badge,
 * and clicking it opens that article.
 */
export function TimelineView({ disc, onSelectSection }: TimelineViewProps) {
  const groups = useMemo(() => collectTimeline(disc), [disc]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className="timeline" aria-label="Explore History">
      <h1 className="timeline__title">Explore History</h1>
      <p className="timeline__lede">
        {total === 0
          ? 'No article on this disc has dated events.'
          : `${total} ${total === 1 ? 'event' : 'events'} from ${disc.title}, oldest first. Pick one to open its article.`}
      </p>
      {total > 0 ? (
        <ol className="timeline__strip" aria-label="Chronology">
          {groups.map((group) => (
            <li key={group.label} className="timeline__era">
              <h2 className="timeline__era-title">{group.label}</h2>
              <ul className="timeline__events" aria-label={group.label}>
                {group.items.map((item, i) => (
                  <li key={`${item.sectionId}-${i}`}>
                    <button type="button" className="timeline__event" onClick={() => onSelectSection(item.sectionId)}>
                      <span className="timeline__when">{item.when}</span>
                      <span className="timeline__text">{item.event}</span>
                      <span className="timeline__badge">{item.sectionTitle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
