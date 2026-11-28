import { useCallback, useId, useRef } from 'react';
import { playClick } from '../audio/audio';
import type { Theme } from '../model/editions';
import { DEFAULT_WALLPAPER, WALLPAPERS } from '../model/wallpapers';
import type { WallpaperId } from '../model/wallpapers';
import { BevelButton } from './BevelButton';
import { DesktopWallpaper } from './DesktopWallpaper';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/shortcuts.css';

export interface DisplayPropertiesDialogProps {
  edition: Theme;
  wallpaper: WallpaperId;
  /** Applies a wallpaper at once (the desktop behind the dialog changes as you pick). */
  onChange: (id: WallpaperId) => void;
  onClose: () => void;
}

/**
 * Win95 "Display Properties" with a Background tab: a monitor preview above a list of wallpapers.
 * Picking one applies it at once; Reset to Edition Default goes back to the edition's own pattern.
 */
export function DisplayPropertiesDialog({ edition, wallpaper, onChange, onClose }: DisplayPropertiesDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const cancel = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, cancel, true);
  const name = useId();
  const current = WALLPAPERS.find((w) => w.id === wallpaper) ?? WALLPAPERS[0]!;

  const pick = (id: WallpaperId) => {
    if (id === wallpaper) return;
    playClick();
    onChange(id);
  };

  return (
    <div ref={layerRef} className="modal-layer">
      <Window title="Display Properties" className="display-properties" modal onClose={cancel}>
        <div className="display-properties__body">
          <span className="display-properties__tab">Background</span>
          <div className="display-properties__panel">
            <div className="display-properties__monitor" aria-hidden="true">
              <div className="display-properties__screen" data-preview={wallpaper}>
                <DesktopWallpaper edition={edition} wallpaper={wallpaper} className="display-properties__preview" />
              </div>
            </div>
            <fieldset className="display-properties__list" aria-label="Wallpaper">
              {WALLPAPERS.map((w) => (
                <label key={w.id} className="display-properties__option" title={w.description}>
                  <input
                    type="radio"
                    name={name}
                    value={w.id}
                    checked={w.id === wallpaper}
                    onChange={() => pick(w.id)}
                  />
                  <span className="display-properties__name">{w.name}</span>
                  <span className="display-properties__desc">{w.description}</span>
                </label>
              ))}
            </fieldset>
            <p className="display-properties__status" aria-live="polite">
              {`Wallpaper: ${current.name}`}
            </p>
          </div>
          <div className="display-properties__buttons">
            <BevelButton disabled={wallpaper === DEFAULT_WALLPAPER} onClick={() => pick(DEFAULT_WALLPAPER)}>
              Reset to Edition Default
            </BevelButton>
            <BevelButton onClick={cancel}>OK</BevelButton>
          </div>
        </div>
      </Window>
    </div>
  );
}
