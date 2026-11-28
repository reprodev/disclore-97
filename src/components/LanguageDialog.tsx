import { useCallback, useId, useRef } from 'react';
import { playClick } from '../audio/audio';
import { LOCALE_INFO, LOCALES } from '../i18n';
import type { Locale } from '../i18n';
import { useT } from '../i18n/LocaleContext';
import { BevelButton } from './BevelButton';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/shortcuts.css';

export interface LanguageDialogProps {
  locale: Locale;
  /** Applies a language at once: the shell behind the dialog switches as you pick. */
  onChange: (locale: Locale) => void;
  onClose: () => void;
}

/** Start > Language...: a Win95 list of the twelve shell languages, each in its own script. */
export function LanguageDialog({ locale, onChange, onClose }: LanguageDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const cancel = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, cancel, true);
  const tr = useT();
  const name = useId();

  return (
    <div ref={layerRef} className="modal-layer">
      <Window title={tr('lang_title')} className="language-dialog" modal onClose={cancel}>
        <div className="language-dialog__body">
          <p className="language-dialog__prompt">{tr('lang_prompt')}</p>
          <fieldset className="display-properties__list language-dialog__list" aria-label={tr('lang_title')}>
            {LOCALES.map((code) => (
              <label key={code} className="display-properties__option" lang={code} dir={LOCALE_INFO[code].dir}>
                <input
                  type="radio"
                  name={name}
                  value={code}
                  checked={code === locale}
                  onChange={() => {
                    playClick();
                    onChange(code);
                  }}
                />
                <span className="display-properties__name">{LOCALE_INFO[code].name}</span>
                <span className="display-properties__desc">{code.toUpperCase()}</span>
              </label>
            ))}
          </fieldset>
          <p className="language-dialog__note">{tr('lang_note')}</p>
          <div className="display-properties__buttons language-dialog__buttons">
            <BevelButton onClick={cancel}>{tr('dp_ok')}</BevelButton>
          </div>
        </div>
      </Window>
    </div>
  );
}
