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
}

/**
 * The Pinpointer: a search bar over every mounted disc. Typing lists matching sections in a
 * sunken dropdown, each with its disc and origin badge. Enter or a click opens that section.
 * Escape, or emptying the box, closes the list.
 */
export function Pinpointer({ discs, removableIds, onOpenSection }: PinpointerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const uid = useId();
  const listId = `${uid}-results`;

  const searching = query.trim().length >= MIN_QUERY_CHARS;
  const hits = useMemo(() => searchSections(discs, query), [discs, query]);
  const showList = open && searching;
  const byId = useMemo(() => new Map(discs.map((d) => [d.disc_id, d])), [discs]);

  const reset = () => {
    setQuery('');
    setOpen(false);
    setActive(0);
  };

  const choose = (hit: SectionRef) => {
    onOpenSection(hit.discId, hit.sectionId);
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
    if (!showList || hits.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(hits[Math.min(active, hits.length - 1)]!);
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
          aria-activedescendant={showList && hits.length > 0 ? `${uid}-hit-${active}` : undefined}
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
            {hits.length === 0 ? (
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
                      aria-selected={i === active}
                      data-active={i === active ? 'true' : 'false'}
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
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
