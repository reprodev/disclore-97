import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { playClick } from '../audio/audio';
import { discOrigin, originClassName } from '../library/discOrigin';
import type { DiscManifest } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { discMeta } from './ExpansionPackList';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './PixelIcon';
import '../styles/home.css';

export type PackFilter = 'all' | 'builtin' | 'burned';

export interface PackShelfProps {
  discs: DiscManifest[];
  /** Ids of burned or mounted discs. Everything else counts as Built-In. */
  removableIds?: ReadonlySet<string>;
  onPick: (discId: string) => void;
  /** Exports a burned disc as a .json disc image. Omit to hide the Save .json button. */
  onSaveDiscImage?: (disc: DiscManifest) => void;
  /** Removes a burned disc from the library. Omit to hide the Eject button. */
  onRemoveDisc?: (discId: string) => void;
  /** Burns a sample disc about a topic. When given, the empty Burned CD-Rs tab offers three quick-start buttons. */
  onBurnSample?: (topic: string) => void;
}

/** Quick-start burns offered while the library has no burned discs: a button label and the topic to look up. */
export const SAMPLE_BURNS: readonly { label: string; topic: string }[] = [
  { label: 'Burn Sample: Halloween', topic: 'Halloween' },
  { label: 'Burn Sample: Gothic fiction', topic: 'Gothic fiction' },
  { label: 'Burn Sample: CD-ROM', topic: 'CD-ROM' },
];

const EMBLEMS: Record<string, IconName> = {
  castles: 'castle',
  'retro-dialup': 'computer',
};

const TABS: readonly PackFilter[] = ['all', 'builtin', 'burned'];

/**
 * The Expansion Packs shelf: Win95 folder tabs (All, Built-In, Burned CD-Rs) above a sunken
 * scrolling shelf with a compact two-column grid of disc cards. Each card has an origin tag,
 * and burned discs add Save .json and Eject buttons.
 */
export function PackShelf({ discs, removableIds, onPick, onSaveDiscImage, onRemoveDisc, onBurnSample }: PackShelfProps) {
  const [filter, setFilter] = useState<PackFilter>('all');
  const uid = useId();
  const isBurned = (d: DiscManifest) => removableIds?.has(d.disc_id) ?? false;

  const burnedCount = discs.filter(isBurned).length;
  const counts: Record<PackFilter, number> = {
    all: discs.length,
    builtin: discs.length - burnedCount,
    burned: burnedCount,
  };
  const labels: Record<PackFilter, string> = {
    all: `All (${counts.all})`,
    builtin: `Built-In (${counts.builtin})`,
    burned: `Burned CD-Rs (${counts.burned})`,
  };

  const shown = discs.filter((d) => (filter === 'all' ? true : filter === 'burned' ? isBurned(d) : !isBurned(d)));

  const choose = (next: PackFilter) => {
    if (next !== filter) playClick();
    setFilter(next);
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const edge = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (step === 0 && edge === null) return;
    e.preventDefault();
    const next = TABS[edge ?? (i + step + TABS.length) % TABS.length]!;
    choose(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  return (
    <div className="pack-tabs-area">
      <div className="pack-tabs" role="tablist" aria-label="Expansion Pack filter">
        {TABS.map((t, i) => (
          <button
            key={t}
            id={`${uid}-tab-${t}`}
            type="button"
            role="tab"
            className="pack-tab"
            aria-selected={filter === t}
            aria-controls={`${uid}-panel`}
            tabIndex={filter === t ? 0 : -1}
            data-active={filter === t ? 'true' : 'false'}
            onClick={() => choose(t)}
            onKeyDown={(e) => onTabKeyDown(e, i)}
          >
            {labels[t]}
          </button>
        ))}
      </div>
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${filter}`} className="pack-shelf">
        {shown.length === 0 ? (
          <div className="pack-shelf__empty">
            <p className="home__empty pack-shelf__message">
              {filter === 'burned'
                ? 'No burned CD-Rs yet. Burn a new disc, or mount a saved disc image.'
                : 'No discs are available.'}
            </p>
            {filter === 'burned' && onBurnSample ? (
              <div className="pack-samples" role="group" aria-label="Sample burns">
                {SAMPLE_BURNS.map((s) => (
                  <BevelButton key={s.topic} className="pack-sample" onClick={() => onBurnSample(s.topic)}>
                    {s.label}
                  </BevelButton>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="pack-grid" aria-label="Discs">
            {shown.map((disc) => {
              const burned = isBurned(disc);
              const origin = discOrigin(disc, !burned);
              const meta = discMeta(disc);
              return (
                <li key={disc.disc_id} className="pack-tile" data-origin={origin}>
                  <BevelButton className="pack-tile__open" onClick={() => onPick(disc.disc_id)}>
                    <span className="pack-card__emblem">
                      <PixelIcon name={EMBLEMS[disc.disc_id] ?? 'cd'} size={32} />
                    </span>
                    <span className="disc-text">
                      <span className="disc-title">{disc.title}</span>
                      <span className="disc-tagline">{disc.tagline}</span>
                      <span className="pack-card__meta" title={meta}>
                        {meta}
                      </span>
                    </span>
                  </BevelButton>
                  <div className="pack-tile__foot">
                    <span className={`pack-badge ${originClassName(origin)}`} data-origin={origin}>
                      {origin}
                    </span>
                    {burned ? (
                      <span className="pack-tile__actions">
                        {onSaveDiscImage ? (
                          <BevelButton
                            className="pack-mini"
                            title={`Save "${disc.title}" as a .json disc image`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSaveDiscImage(disc);
                            }}
                          >
                            Save .json
                          </BevelButton>
                        ) : null}
                        {onRemoveDisc ? (
                          <BevelButton
                            className="pack-mini"
                            title={`Eject "${disc.title}" from the library`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveDisc(disc.disc_id);
                            }}
                          >
                            Eject
                          </BevelButton>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
