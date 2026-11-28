import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { formatElapsed } from '../model/daily';
import type { DailyResult } from '../model/daily';
import { editionOf } from '../model/editions';
import type { Theme } from '../model/editions';
import type { PersonalBest } from '../model/game';
import { useLocale, useT } from '../i18n/LocaleContext';
import { discTextAttrs, LANGUAGE_NAMES, toWikiLanguage } from '../model/languages';
import type { DiscManifest, Section } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { HeroArt } from './SplashArt';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/article.css';
import '../styles/print.css';

/** Encyclopedia-style citation: `"Section Title." DiscLore '97: Disc Title.` */
export function formatCitation(sectionTitle: string, discTitle: string): string {
  return `"${sectionTitle}." DiscLore '97: ${discTitle}.`;
}

/** What the Jewel-Case Booklet prints: the disc, its edition, and its KeepMaze records. */
export interface BookletData {
  disc: DiscManifest;
  edition: Theme;
  best?: PersonalBest | null;
  /** Today's Daily Challenge best on this disc, when there is one. */
  daily?: { day: string; result: DailyResult } | null;
}

export interface CiteDialogProps {
  section: Section;
  discTitle: string;
  onClose: () => void;
  /** When given, the dialog gets a Jewel-Case Booklet tab beside the citation. */
  booklet?: BookletData;
  /** The disc's Wikipedia language: the citation and preview are marked with it. */
  language?: string;
}

/** Quick Facts for the booklet's highlight panel: the first few across the disc, in article order. */
export function bookletFacts(disc: DiscManifest, max = 4): string[] {
  return disc.sections.flatMap((s) => s.facts ?? []).slice(0, max);
}

/** The 1997 CD-ROM jewel-case insert: a front cover and a back tray with the tracklist. */
export function JewelCaseBooklet({
  disc,
  edition,
  best,
  daily,
  id,
  labelledBy,
  hidden = false,
}: BookletData & { id?: string; labelledBy?: string; hidden?: boolean }) {
  const tr = useT();
  const title = disc.title.replace(/^DiscLore '97:\s*/, '');
  const lang = toWikiLanguage(disc.language);
  const facts = bookletFacts(disc);
  // The disc's own text (title, tracks, facts) is marked with its language and direction.
  const discLang = discTextAttrs(disc.language, useLocale());
  return (
    <div
      className="booklet"
      hidden={hidden}
      {...(id ? { id, role: 'tabpanel', 'aria-labelledby': labelledBy } : { role: 'region', 'aria-label': tr('booklet_title') })}
    >
      <section className="booklet__front" aria-label={tr('booklet_front')}>
        <div className="booklet__emblem">
          <HeroArt edition={edition} />
        </div>
        <p className="booklet__brand">
          DiscLore <span className="booklet__year">'97</span>
        </p>
        <h2 className="booklet__title" {...discLang}>
          {title}
        </h2>
        <p className="booklet__badges">
          <span className="booklet__badge">{editionOf(edition).name}</span>
          <span className="booklet__badge booklet__badge--lang">{`${lang.toUpperCase()} \u2022 ${LANGUAGE_NAMES[lang]}`}</span>
        </p>
        <p className="booklet__foot">{tr('booklet_foot')}</p>
      </section>
      <section className="booklet__back" aria-label={tr('booklet_back')}>
        <p className="booklet__spine" aria-hidden="true" {...discLang}>
          {`DISCLORE '97 \u2022 ${title.toUpperCase()}`}
        </p>
        <div className="booklet__tray">
          <h3 className="booklet__heading">{tr('booklet_tracks')}</h3>
          <ol className="booklet__tracks" {...discLang}>
            {disc.sections.map((s, i) => (
              <li key={s.section_id} className="booklet__track">
                <span className="booklet__track-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="booklet__track-title">{s.title}</span>
              </li>
            ))}
          </ol>
          {facts.length > 0 ? (
            <>
              <h3 className="booklet__heading">{tr('booklet_facts')}</h3>
              <ul className="booklet__facts" {...discLang}>
                {facts.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </>
          ) : null}
          <h3 className="booklet__heading">KeepMaze</h3>
          <p className="booklet__record">
            {best ? tr('booklet_best', { score: best.bestScore, rank: best.bestRank }) : tr('booklet_bestNone')}
          </p>
          <p className="booklet__record">
            {daily
              ? tr('booklet_daily', { day: daily.day, score: daily.result.score, time: formatElapsed(daily.result.timeMs) })
              : tr('booklet_dailyNone')}
          </p>
        </div>
      </section>
    </div>
  );
}

type CopyState = 'idle' | 'copied' | 'manual';

/**
 * Modal "Cite / Print Preview" dialog: shows the citation and a page-style
 * preview of the article, with a Copy Citation button.
 */
export function CiteDialog({ section, discTitle, onClose, booklet, language }: CiteDialogProps) {
  /** The citation and print preview are disc text, so they carry the disc's language and direction. */
  const pageLang = discTextAttrs(language ?? booklet?.disc.language, useLocale());
  const layerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const [copy, setCopy] = useState<CopyState>('idle');
  /** Which sheet is on show, and so which one prints. */
  const [mode, setMode] = useState<'citation' | 'booklet'>('citation');
  const showBooklet = booklet !== undefined && mode === 'booklet';
  const tr = useT();
  const uid = useId();
  const tabId = (m: 'citation' | 'booklet') => `${uid}-tab-${m}`;
  const panelId = (m: 'citation' | 'booklet') => `${uid}-panel-${m}`;
  /** Arrow keys, Home, and End move between the two tabs and select them, as Win95 tabs do. */
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const order = ['citation', 'booklet'] as const;
    const at = order.indexOf(mode);
    let next: (typeof order)[number] | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
      const forward = (e.key === 'ArrowRight') !== rtl;
      next = order[(at + (forward ? 1 : order.length - 1)) % order.length];
    } else if (e.key === 'Home') next = order[0];
    else if (e.key === 'End') next = order[order.length - 1];
    if (!next) return;
    e.preventDefault();
    setMode(next);
    document.getElementById(tabId(next))?.focus();
  };
  const citation = formatCitation(section.title, discTitle);

  const cancel = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, cancel, true);

  // Marks the page while the sheet is open, so the print rules show only the citation sheet.
  useEffect(() => {
    document.body.classList.add('cite-printing');
    return () => document.body.classList.remove('cite-printing');
  }, []);
  // In booklet mode the print rules print the jewel-case insert instead of the citation page.
  useEffect(() => {
    if (!showBooklet) return;
    document.body.classList.add('booklet-printing');
    return () => document.body.classList.remove('booklet-printing');
  }, [showBooklet]);

  /** Opens the browser's print dialog. The button plays its usual click. */
  const print = () => window.print();

  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopy('copied');
    } catch {
      // No clipboard access: select the text so Ctrl+C works.
      textRef.current?.focus();
      textRef.current?.select();
      setCopy('manual');
    }
  };

  const host = document.querySelector('.desktop__work') ?? document.body;

  return createPortal(
    <div ref={layerRef} className="modal-layer">
      <Window title={tr('cite_title')} className="cite-dialog" modal onClose={cancel}>
        <div className="cite-dialog__body">
          {booklet ? (
            <div className="cite-dialog__tabs" role="tablist" aria-label={tr('cite_sheet')} onKeyDown={onTabKey}>
              <button
                type="button"
                role="tab"
                id={tabId('citation')}
                className="cite-dialog__tab"
                aria-selected={!showBooklet}
                aria-controls={panelId('citation')}
                tabIndex={showBooklet ? -1 : 0}
                onClick={() => setMode('citation')}
              >
                {tr('cite_citation')}
              </button>
              <button
                type="button"
                role="tab"
                id={tabId('booklet')}
                className="cite-dialog__tab"
                aria-selected={showBooklet}
                aria-controls={panelId('booklet')}
                tabIndex={showBooklet ? 0 : -1}
                onClick={() => setMode('booklet')}
              >
                {tr('booklet_title')}
              </button>
            </div>
          ) : null}
          {/* Both panels stay in the page, so each tab's aria-controls always names a real element. */}
          {booklet ? <JewelCaseBooklet {...booklet} id={panelId('booklet')} labelledBy={tabId('booklet')} hidden={!showBooklet} /> : null}
          <div
            className="cite-dialog__sheet"
            hidden={showBooklet}
            {...(booklet ? { id: panelId('citation'), role: 'tabpanel', 'aria-labelledby': tabId('citation') } : {})}
          >
          <label htmlFor="cite-text" className="cite-dialog__label" hidden={showBooklet}>
            {tr('cite_citation')}
          </label>
          <textarea
            id="cite-text"
            {...pageLang}
            ref={textRef}
            className="cite-dialog__text"
            rows={2}
            readOnly
            value={citation}
            hidden={showBooklet}
          />
          <div className="cite-dialog__page" aria-label={tr('cite_preview')} hidden={showBooklet} {...pageLang}>
            <p className="cite-dialog__running">DiscLore '97 &bull; {discTitle}</p>
            <h2 className="cite-dialog__heading">{section.title}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="cite-dialog__para">
                {p}
              </p>
            ))}
            <p className="cite-dialog__foot">{citation}</p>
          </div>
          </div>
          <div className="cite-dialog__buttons">
            <span className="cite-dialog__note" aria-live="polite">
              {copy === 'copied' ? tr('cite_copied') : copy === 'manual' ? tr('cite_manual') : ''}
            </span>
            <BevelButton onClick={() => void copyCitation()}>{tr('cite_copy')}</BevelButton>
            <BevelButton onClick={print}>{tr('cite_print')}</BevelButton>
            <BevelButton onClick={cancel}>{tr('cite_close')}</BevelButton>
          </div>
        </div>
      </Window>
    </div>,
    host,
  );
}
