import { useId, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { discOrigin, originClassName } from '../library/discOrigin';
import type { DiscManifest } from '../model/manifest';
import { MIN_QUERY_CHARS, searchSections } from '../model/discSearch';
import type { SectionRef } from '../model/discSearch';
import '../styles/home.css';

export interface PinpointerProps {
  discs: DiscManifest[];
  /** Ids of burned or mounted discs, so each result can carry the right origin badge. */
  removableIds?: ReadonlySet<string>;
  /** Opens a disc straight to a section. */
  onOpenSection: (discId: string, sectionId: string) => void;
  /**
   * Burns a disc about the typed text. When given, the dropdown ends with a
   * `Burn CD-R for "..." (Wikipedia)...` row, even when no article matches.
   */
  onBurnTopic?: (topic: string) => void;
}

/**
 * The Pinpointer: a search bar over every mounted disc. Typing lists matching sections in a
 * sunken dropdown, each with its disc and origin badge. Enter or a click opens that section.
 * The last row offers to burn a Wikipedia disc for what was typed. Escape, or emptying the
 * box, closes the list.
 */
export function Pinpointer({ discs, removableIds, onOpenSection, onBurnTopic }: PinpointerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const uid = useId();
  const listId = `${uid}-results`;

  const topic = query.trim();
  const searching = topic.length >= MIN_QUERY_CHARS;
  const hits = useMemo(() => searchSections(discs, query), [discs, query]);
  const showList = open && searching;
  const byId = useMemo(() => new Map(discs.map((d) => [d.disc_id, d])), [discs]);

  // Rows are the local results, then the burn row when it is offered.
  const burnRow = onBurnTopic !== undefined;
  const rowCount = hits.length + (burnRow ? 1 : 0);
  const current = Math.min(active, Math.max(rowCount - 1, 0));

  const reset = () => {
    setQuery('');
    setOpen(false);
    setActive(0);
  };

  const choose = (hit: SectionRef) => {
    onOpenSection(hit.discId, hit.sectionId);
    reset();
  };

  const burn = () => {
    if (!onBurnTopic || !searching) return;
    onBurnTopic(topic);
    reset();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (query !== '' || open) {
        e.preventDefault();
        reset();
      }
      return;
    }
    if (!showList || rowCount === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (Math.min(a, rowCount - 1) + (e.key === 'ArrowDown' ? 1 : -1) + rowCount) % rowCount);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (current < hits.length) choose(hits[current]!);
      else burn();
    }
  };

  return (
    <div className="pinpointer">
      <label className="pinpointer__label" htmlFor={`${uid}-input`}>
        Pinpointer
      </label>
      <div className="pinpointer__field">
        <input
          id={`${uid}-input`}
          className="pinpointer__input"
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search all discs..."
          aria-label={'Pinpointer \u2014 Search all discs...'}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && rowCount > 0 ? `${uid}-hit-${current}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(e.target.value.trim() !== '');
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(query.trim() !== '')}
          onBlur={() => setOpen(false)}
        />
        {showList ? (
          // Mouse presses must not take focus from the input, or the list would close before the click lands.
          <div className="pinpointer__results" onMouseDown={(e) => e.preventDefault()}>
            {rowCount === 0 ? (
              <p className="pinpointer__empty">No matching articles.</p>
            ) : (
              <ul id={listId} role="listbox" aria-label="Matching articles" className="pinpointer__list">
                {hits.map((hit, i) => {
                  const disc = byId.get(hit.discId);
                  const origin = disc ? discOrigin(disc, !(removableIds?.has(hit.discId) ?? false)) : 'Disc Image';
                  return (
                    <li
                      key={`${hit.discId}/${hit.sectionId}`}
                      id={`${uid}-hit-${i}`}
                      role="option"
                      aria-selected={i === current}
                      data-active={i === current ? 'true' : 'false'}
                      className="pinpointer__hit"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(hit)}
                    >
                      <span className="pinpointer__title">{hit.sectionTitle}</span>
                      <span className="pinpointer__disc">{hit.discTitle}</span>
                      <span className={`pack-badge ${originClassName(origin)}`} data-origin={origin}>
                        {origin}
                      </span>
                    </li>
                  );
                })}
                {burnRow ? (
                  <li
                    id={`${uid}-hit-${hits.length}`}
                    role="option"
                    aria-selected={current === hits.length}
                    data-active={current === hits.length ? 'true' : 'false'}
                    className="pinpointer__hit pinpointer__burn"
                    title={`Burn a CD-R about "${topic}" from Wikipedia`}
                    onMouseEnter={() => setActive(hits.length)}
                    onClick={burn}
                  >
                    <span className="pinpointer__title">{`Burn CD-R for "${topic}" (Wikipedia)...`}</span>
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
