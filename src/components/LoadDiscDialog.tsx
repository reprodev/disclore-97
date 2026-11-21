import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { DiscManifest } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { ExpansionPackList } from './ExpansionPackList';
import { Window } from './Window';
import '../styles/browser.css';

export interface LoadDiscDialogProps {
  discs: DiscManifest[];
  /** The disc that is open behind the dialog. Picking it again just dismisses the dialog. */
  currentDiscId: string;
  /** Called with a different disc's id. */
  onLoad: (discId: string) => void;
  /** Called by Cancel, the title bar Close button, and Escape. */
  onCancel: () => void;
  /** Closes this dialog, then opens the Burn dialog. Omit to hide the button. */
  onBurnNew?: () => void;
  /** Ids of burned discs that may be removed from the library. */
  removableIds?: ReadonlySet<string>;
  /** Called with a burned disc's id by its Remove control. */
  onRemoveDisc?: (discId: string) => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal "Load Disc" dialog drawn over the open disc window. Escape cancels,
 * Tab stays inside the dialog, and focus returns to where it was on close.
 */
export function LoadDiscDialog({
  discs,
  currentDiscId,
  onLoad,
  onCancel,
  onBurnNew,
  removableIds,
  onRemoveDisc,
}: LoadDiscDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const layer = layerRef.current;
    const firstPack = layer?.querySelector<HTMLElement>('.disc-open');
    (firstPack ?? layer?.querySelector<HTMLElement>(FOCUSABLE))?.focus();

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && previous.isConnected) previous.focus();
    };
    // Mount-only: the dialog's focus and key handling must not restart on re-render.
  }, []);

  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !layerRef.current) return;
    const items = Array.from(layerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div ref={layerRef} className="modal-layer" onKeyDown={trapTab}>
      <Window title="Load Disc — Expansion Packs" className="load-dialog" modal onClose={onCancel}>
        <div className="load-dialog__body">
          <p className="load-dialog__prompt">Choose an Expansion Pack to load. Your current disc stays open if you cancel.</p>
          <fieldset className="groupbox">
            <legend className="groupbox__legend">Expansion Packs (CD-ROM Drive D:)</legend>
            <ExpansionPackList
              discs={discs}
              currentDiscId={currentDiscId}
              onPick={(id) => (id === currentDiscId ? onCancel() : onLoad(id))}
              renderExtra={
                onRemoveDisc && removableIds
                  ? (disc) =>
                      removableIds.has(disc.disc_id) && disc.disc_id !== currentDiscId ? (
                        <BevelButton
                          className="disc-remove"
                          aria-label={`Remove ${disc.title} from library`}
                          onClick={() => onRemoveDisc(disc.disc_id)}
                        >
                          Remove
                        </BevelButton>
                      ) : null
                  : undefined
              }
            />
          </fieldset>
          <div className="load-dialog__buttons">
            {onBurnNew ? (
              <BevelButton
                onClick={() => {
                  onCancel();
                  onBurnNew();
                }}
              >
                Burn New Disc...
              </BevelButton>
            ) : null}
            <BevelButton onClick={onCancel}>Cancel</BevelButton>
          </div>
        </div>
      </Window>
    </div>
  );
}
