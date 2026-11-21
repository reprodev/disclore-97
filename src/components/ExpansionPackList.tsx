import type { ReactNode } from 'react';
import type { DiscManifest } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './PixelIcon';
import '../styles/browser.css';

export interface ExpansionPackListProps {
  discs: DiscManifest[];
  /** Id of the disc that is already open, marked as such. Omit when none is open. */
  currentDiscId?: string | null;
  onPick: (discId: string) => void;
  /** `card` is the large Home launcher card with an emblem and counts. `compact` is the plain list row. */
  variant?: 'compact' | 'card';
  /** Optional slot rendered beside each disc button, for example a Remove control. */
  renderExtra?: (disc: DiscManifest) => ReactNode;
}

const EMBLEMS: Record<string, IconName> = {
  castles: 'castle',
  'retro-dialup': 'computer',
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One-line counts for a disc, for example "5 sections • 1 diagram • 6 trivia • 1 dungeon". */
export function discMeta(disc: DiscManifest): string {
  return [
    count(disc.sections.length, 'section', 'sections'),
    count(disc.diagrams.length, 'diagram', 'diagrams'),
    `${disc.trivia.length} trivia`,
    count(disc.dungeons.length, 'dungeon', 'dungeons'),
  ].join(' \u2022 ');
}

/** The disc buttons: one per Expansion Pack. Rendered immediately, no loading state. */
export function ExpansionPackList({
  discs,
  currentDiscId = null,
  onPick,
  variant = 'compact',
  renderExtra,
}: ExpansionPackListProps) {
  const card = variant === 'card';
  return (
    <ul className={card ? 'disc-list disc-list--cards' : 'disc-list'} aria-label="Discs">
      {discs.map((disc) => {
        const current = disc.disc_id === currentDiscId;
        const classes = ['disc-open'];
        if (card) classes.push('pack-card');
        if (current) classes.push('disc-open--current');
        const extra = renderExtra?.(disc) ?? null;
        return (
          <li key={disc.disc_id} className={extra ? 'disc-list-item disc-list-item--extra' : 'disc-list-item'}>
            <BevelButton
              className={classes.join(' ')}
              aria-current={current ? 'true' : undefined}
              onClick={() => onPick(disc.disc_id)}
            >
              {card ? (
                <span className="pack-card__emblem">
                  <PixelIcon name={EMBLEMS[disc.disc_id] ?? 'cd'} size={32} />
                </span>
              ) : (
                <PixelIcon name="cd" size={32} />
              )}
              <span className="disc-text">
                <span className="disc-title">{disc.title}</span>
                <span className="disc-tagline">{disc.tagline}</span>
                {card ? <span className="pack-card__meta">{discMeta(disc)}</span> : null}
                {current ? <span className="disc-current">Currently open</span> : null}
              </span>
            </BevelButton>
            {extra}
          </li>
        );
      })}
    </ul>
  );
}
