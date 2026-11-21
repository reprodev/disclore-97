import type { DiscManifest } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { PixelIcon } from './PixelIcon';
import '../styles/browser.css';

export interface ExpansionPackListProps {
  discs: DiscManifest[];
  /** Id of the disc that is already open, marked as such. Omit when none is open. */
  currentDiscId?: string | null;
  onPick: (discId: string) => void;
}

/** The disc buttons: one per Expansion Pack. Rendered immediately, no loading state. */
export function ExpansionPackList({ discs, currentDiscId = null, onPick }: ExpansionPackListProps) {
  return (
    <ul className="disc-list" aria-label="Discs">
      {discs.map((disc) => {
        const current = disc.disc_id === currentDiscId;
        return (
          <li key={disc.disc_id} className="disc-list-item">
            <BevelButton
              className={current ? 'disc-open disc-open--current' : 'disc-open'}
              aria-current={current ? 'true' : undefined}
              onClick={() => onPick(disc.disc_id)}
            >
              <PixelIcon name="cd" size={32} />
              <span className="disc-text">
                <span className="disc-title">{disc.title}</span>
                <span className="disc-tagline">{disc.tagline}</span>
                {current ? <span className="disc-current">Currently open</span> : null}
              </span>
            </BevelButton>
          </li>
        );
      })}
    </ul>
  );
}
