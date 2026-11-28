import { useCallback, useId, useRef } from 'react';
import { playClick } from '../audio/audio';
import { LOCALE_INFO, LOCALES } from '../i18n';
import type { Locale, MessageKey } from '../i18n';
import { useLocale, useT } from '../i18n/LocaleContext';
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
  /** Switches the shell language. When given, a quick Language selector sits under the list. */
  onLocaleChange?: (locale: Locale) => void;
}

/**
 * Win95 "Display Properties" with a Background tab: a monitor preview above a list of wallpapers.
 * Picking one applies it at once; Reset to Edition Default goes back to the edition's own pattern.
 */
export function DisplayPropertiesDialog({ edition, wallpaper, onChange, onClose, onLocaleChange }: DisplayPropertiesDialogProps) {
  const tr = useT();
  const locale = useLocale();
  const langId = useId();
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
      <Window title={tr('dp_title')} className="display-properties" modal onClose={cancel}>
        <div className="display-properties__body">
          <span className="display-properties__tab">{tr('dp_background')}</span>
          <div className="display-properties__panel">
            <div className="display-properties__monitor" aria-hidden="true">
              <div className="display-properties__screen" data-preview={wallpaper}>
                <DesktopWallpaper edition={edition} wallpaper={wallpaper} className="display-properties__preview" />
              </div>
            </div>
            <fieldset className="display-properties__list" aria-label={tr('dp_wallpaperList')}>
              {WALLPAPERS.map((w) => (
                <label key={w.id} className="display-properties__option" title={tr(`wpd_${w.id}` as MessageKey)}>
                  <input
                    type="radio"
                    name={name}
                    value={w.id}
                    checked={w.id === wallpaper}
                    onChange={() => pick(w.id)}
                  />
                  <span className="display-properties__name">{tr(`wp_${w.id}` as MessageKey)}</span>
                  <span className="display-properties__desc">{tr(`wpd_${w.id}` as MessageKey)}</span>
                </label>
              ))}
            </fieldset>
            <p className="display-properties__status" aria-live="polite">
              {tr('dp_wallpaper', { name: tr(`wp_${current.id}` as MessageKey) })}
            </p>
            {onLocaleChange ? (
              <div className="display-properties__language">
                <label htmlFor={langId}>{tr('dp_language')}</label>
                <select
                  id={langId}
                  className="win95-select"
                  value={locale}
                  onChange={(e) => onLocaleChange(e.target.value as Locale)}
                >
                  {LOCALES.map((code) => (
                    <option key={code} value={code} lang={code}>
                      {LOCALE_INFO[code].name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="display-properties__buttons">
            <BevelButton disabled={wallpaper === DEFAULT_WALLPAPER} onClick={() => pick(DEFAULT_WALLPAPER)}>
              {tr('dp_reset')}
            </BevelButton>
            <BevelButton onClick={cancel}>{tr('dp_ok')}</BevelButton>
          </div>
        </div>
      </Window>
    </div>
  );
}
