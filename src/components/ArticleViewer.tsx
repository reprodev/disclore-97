import { Fragment, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { isMuted, playPageFlip, subscribeMuted } from '../audio/audio';
import { isSpeechAvailable, speak, stopSpeaking } from '../audio/speech';
import type { Diagram, MediaItem, Section } from '../model/manifest';
import { linkSegments } from '../model/crossLinks';
import { normalizeQuery, splitByQuery } from '../model/findInText';
import { quoteText } from '../library/notebook';
import { relatedSections } from '../model/topics';
import { BevelButton } from './BevelButton';
import { useLocale } from '../i18n/LocaleContext';
import { discTextAttrs } from '../model/languages';
import { CiteDialog } from './CiteDialog';
import type { BookletData } from './CiteDialog';
import { MediaReel } from './MediaReel';
import { Plate } from './Plate';
import '../styles/article.css';
import '../styles/notebook.css';

export interface ArticleViewerProps {
  sections: Section[];
  /** Currently selected section id. */
  sectionId: string;
  /** Opens another section. When omitted, the See Also strip is not shown. */
  onSelectSection?: (sectionId: string) => void;
  /** Title of the open disc. When given, the Cite / Print Preview button is shown. */
  discTitle?: string;
  /** Diagrams of the open disc. With onShowInDiagram, enables the Show in Diagram button. */
  diagrams?: Diagram[];
  /** Opens a diagram with the hotspot for the active section highlighted. */
  onShowInDiagram?: (diagramId: string, sectionId: string) => void;
  /** Whether this article is bookmarked. With onToggleBookmark, shows the Bookmark button. */
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  /** Pictures of the open disc. When non-empty, the Media Frame and Multimedia Reel replace the plate. */
  media?: MediaItem[];
  /** Called with a single word the reader double-clicked in the text. Opens the Dictionary. */
  onLookUpWord?: (word: string) => void;
  /** Adds a Quick Fact to the disc's Research Notebook. When omitted, the + Note buttons are not shown. */
  onAddNote?: (sectionTitle: string, fact: string) => void;
  /** The disc's Wikipedia language: Read Aloud uses a matching voice, and Arabic reads right to left. */
  language?: string;
  /** Data for the Jewel-Case Booklet tab in Cite / Print Preview. */
  booklet?: BookletData;
}

export function ArticleViewer({
  sections,
  sectionId,
  onSelectSection,
  discTitle,
  diagrams,
  onShowInDiagram,
  bookmarked = false,
  onToggleBookmark,
  media,
  onLookUpWord,
  onAddNote,
  language,
  booklet,
}: ArticleViewerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const shellLocale = useLocale();
  const [citeOpen, setCiteOpen] = useState(false);
  /** Narration progress, 1-based paragraph number out of the total. Null when not speaking. */
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const speaking = progress !== null;
  /** Reading speed: normal, or brisk. */
  const [rate, setRate] = useState<1 | 1.2>(1);
  const [muted, setMuted] = useState(isMuted);
  /** Find in Article bar: open flag, the query (kept across articles), and the current match. */
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findIndex, setFindIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  /** The article body under the pinned header: the only part of an article that scrolls. */
  const bodyRef = useRef<HTMLDivElement | null>(null);
  /** The fact just added to the Notebook, shown briefly as confirmation. */
  const [noteAdded, setNoteAdded] = useState(false);
  /** The quote just added with + Quote, shown briefly. */
  const [quoteAdded, setQuoteAdded] = useState(false);
  /** The selection when the + Quote button was pressed: pressing a button can clear it before the click. */
  const pendingQuote = useRef('');
  const section = sections.find((s) => s.section_id === sectionId);
  const found = section !== undefined;

  useEffect(() => {
    // The body is the scroller; the article itself is reset too, in case a narrow layout scrolls it.
    if (ref.current) ref.current.scrollTop = 0;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (found) playPageFlip();
  }, [sectionId, found]);

  // Narration belongs to one article: it stops on a section change and on unmount.
  useEffect(() => {
    setProgress(null);
    return () => stopSpeaking();
  }, [sectionId]);

  // Keep the paragraph being read in view.
  const speakingAt = progress?.current ?? 0;
  useEffect(() => {
    if (speakingAt === 0) return;
    const el = ref.current?.querySelector<HTMLElement>('[data-speaking="true"]');
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [speakingAt]);

  // The confirmation belongs to one article and fades after a moment.
  useEffect(() => {
    setNoteAdded(false);
    setQuoteAdded(false);
  }, [sectionId]);
  useEffect(() => {
    if (!quoteAdded) return;
    const id = window.setTimeout(() => setQuoteAdded(false), 2500);
    return () => window.clearTimeout(id);
  }, [quoteAdded]);
  useEffect(() => {
    if (!noteAdded) return;
    const id = window.setTimeout(() => setNoteAdded(false), 2500);
    return () => window.clearTimeout(id);
  }, [noteAdded]);

  // Each article starts at its first match.
  useEffect(() => {
    setFindIndex(0);
  }, [sectionId]);

  // Ctrl+F / Cmd+F opens and focuses the find bar instead of the browser's own find. A dialog on top keeps the default.
  useEffect(() => {
    if (!found) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'f') return;
      if (document.querySelector('.modal-layer')) return;
      e.preventDefault();
      setFindOpen(true);
      findInputRef.current?.focus();
      findInputRef.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [found]);

  // Focus the search box when the bar opens.
  useEffect(() => {
    if (findOpen) findInputRef.current?.focus();
  }, [findOpen]);

  // Keep the current match in view.
  const hitKey = findOpen ? [findQuery, findIndex, sectionId].join('|') : '';
  useEffect(() => {
    if (hitKey === '') return;
    ref.current?.querySelector<HTMLElement>('.article-hit--current')?.scrollIntoView?.({ block: 'nearest' });
  }, [hitKey]);

  // Mute stops speech itself (see speech.ts). This only keeps the button in step.
  useEffect(() => subscribeMuted(setMuted), []);

  // A dialog for the previous article must not stay open on the next one.
  useEffect(() => {
    setCiteOpen(false);
  }, [sectionId]);

  if (!section) {
    return (
      <article ref={ref} className="article-viewer" role="alert">
        <p className="article-not-found">Section not found: {sectionId}</p>
      </article>
    );
  }

  const related = onSelectSection ? relatedSections(sections, sectionId) : [];
  const facts = section.facts ?? [];
  const timeline = section.timeline ?? [];
  const diagramLink = onShowInDiagram
    ? (diagrams ?? []).find((d) => d.hotspots.some((h) => h.section_id === sectionId))
    : undefined;
  const canCite = discTitle !== undefined;
  /** Other articles of this disc whose titles may be linked from the text. */
  const linkTargets = sections.filter((s) => s.section_id !== sectionId);
  const reel = media ?? [];
  const speechReady = isSpeechAvailable();

  /** Paragraphs split into plain text and cross-link pieces. Matches are counted piece by piece. */
  const paragraphSegments = section.paragraphs.map((p) => (onSelectSection ? linkSegments(p, linkTargets) : [{ text: p }]));
  const needle = findOpen ? normalizeQuery(findQuery) : '';
  const totalHits =
    needle === ''
      ? 0
      : paragraphSegments.reduce(
          (sum, segs) => sum + segs.reduce((s, seg) => s + splitByQuery(seg.text, needle).filter((x) => x.hit).length, 0),
          0,
        );
  const currentHit = totalHits === 0 ? 0 : Math.min(findIndex, totalHits - 1);
  let hitCounter = 0;
  /** Text pieces for one segment, with the matches wrapped in <mark>. Numbers matches in render order. */
  const renderPieces = (text: string) =>
    needle === ''
      ? text
      : splitByQuery(text, needle).map((piece, k) => {
          if (!piece.hit) return <Fragment key={k}>{piece.text}</Fragment>;
          const n = hitCounter++;
          return (
            <mark key={k} className={n === currentHit ? 'article-hit article-hit--current' : 'article-hit'}>
              {piece.text}
            </mark>
          );
        });

  const stepHit = (d: number) => {
    if (totalHits > 0) setFindIndex((currentHit + d + totalHits) % totalHits);
  };
  const closeFind = () => setFindOpen(false);
  const onFindKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeFind();
    } else if (e.key === 'Enter' && e.target === findInputRef.current) {
      e.preventDefault();
      stepHit(e.shiftKey ? -1 : 1);
    }
  };

  /** The selected text, when the selection is inside this article. Empty otherwise. */
  const readSelection = (): string => {
    const sel = window.getSelection?.();
    const text = sel?.toString() ?? '';
    if (text.trim() === '') return '';
    const node = sel?.anchorNode;
    if (node instanceof Node && !(ref.current?.contains(node) ?? false)) return '';
    return text;
  };

  /** + Quote: the selected text (or the article's first sentence) as a quoted line in the Notebook. */
  const addQuote = () => {
    if (!onAddNote) return;
    const picked = pendingQuote.current || readSelection();
    pendingQuote.current = '';
    const lead = (section.paragraphs[0] ?? '').trim();
    const firstSentence = /^[\s\S]*?[.!?](?=\s|$)/.exec(lead)?.[0] ?? lead;
    const quote = quoteText(picked || firstSentence || section.title);
    if (quote === '') return;
    onAddNote(section.title, quote);
    setQuoteAdded(true);
  };

  /** A double-click on one word of the text opens the Dictionary for it. */
  const onParagraphDoubleClick = (e: MouseEvent<HTMLElement>) => {
    if (!onLookUpWord) return;
    if (e.target instanceof Element && e.target.closest('button')) return;
    const picked = window.getSelection?.()?.toString().trim() ?? '';
    if (/^\p{L}[\p{L}'’-]{0,39}$/u.test(picked)) onLookUpWord(picked);
  };

  /** Narrates the title and paragraphs from item rom (0 is the title). Progress counts the whole list. */
  const startSpeech = (from: number, speed: number) => {
    const texts = [section.title, ...section.paragraphs];
    speak(
      texts.slice(from),
      () => setProgress(null),
      (current, total) => setProgress({ current: current + from, total: total + from }),
      speed,
      language,
    );
  };

  const toggleSpeech = () => {
    if (speaking) {
      stopSpeaking();
      return;
    }
    startSpeech(0, rate);
  };

  /** Switches between 1x and 1.2x. While narrating, it carries on from the current paragraph at the new speed. */
  const toggleRate = () => {
    const next = rate === 1 ? 1.2 : 1;
    setRate(next);
    if (progress) startSpeech(progress.current - 1, next);
  };

  return (
    <article
      ref={ref}
      className="article-viewer"
      {...discTextAttrs(language, shellLocale)}
    >
      {/* Pinned header: the title, the tool row, and the Find bar stay put while the body scrolls. */}
      <header className="article-header">
        <h1 className={progress?.current === 1 ? 'article-title article-title--speaking' : 'article-title'} data-speaking={progress?.current === 1 ? 'true' : undefined}>
          {section.title}
        </h1>
        <div className="article-tools" role="group" aria-label="Article tools">
          {diagramLink ? (
            <BevelButton onClick={() => onShowInDiagram?.(diagramLink.diagram_id, sectionId)}>
              Show in Diagram
            </BevelButton>
          ) : null}
          {canCite ? <BevelButton onClick={() => setCiteOpen(true)}>Cite / Print Preview</BevelButton> : null}
          {onToggleBookmark ? (
            <BevelButton className="article-tools__toggle" aria-pressed={bookmarked} onClick={onToggleBookmark}>
              {bookmarked ? 'Bookmarked' : 'Bookmark'}
            </BevelButton>
          ) : null}
          <BevelButton
            className="article-tools__toggle"
            aria-pressed={speaking}
            disabled={!speechReady || (muted && !speaking)}
            title={
              !speechReady
                ? 'Narration is not available in this browser'
                : muted
                  ? 'Sound is muted'
                  : 'Read this article aloud'
            }
            onClick={toggleSpeech}
          >
            {progress ? `Stop (${progress.current}/${progress.total})` : 'Read Aloud'}
          </BevelButton>
          <BevelButton className="article-tools__toggle" aria-pressed={findOpen} onClick={() => setFindOpen((o) => !o)}>
            Find in Article
          </BevelButton>
          {onAddNote ? (
            <BevelButton
              className="article-tools__quote"
              title="Add the selected text to the Notebook, or the first sentence when nothing is selected"
              onPointerDown={() => {
                pendingQuote.current = readSelection();
              }}
              onClick={addQuote}
            >
              + Quote
            </BevelButton>
          ) : null}
          {onAddNote ? (
            <span className="article-tools__added" aria-live="polite">
              {quoteAdded ? 'Quote added to Notebook.' : ''}
            </span>
          ) : null}
          <BevelButton
            className="article-tools__rate"
            disabled={!speechReady}
            title={`Reading speed: ${rate === 1 ? 'normal' : 'brisk'}. Click to change.`}
            onClick={toggleRate}
          >
            {rate === 1 ? '1x' : '1.2x'}
          </BevelButton>
        </div>
        {findOpen ? (
          <div className="article-find" role="search" aria-label="Find in article" onKeyDown={onFindKey}>
            <label htmlFor="article-find-input">Find:</label>
            <input
              id="article-find-input"
              ref={findInputRef}
              className="article-find__input"
              type="text"
              autoComplete="off"
              aria-label="Find in article"
              value={findQuery}
              onChange={(e) => {
                setFindQuery(e.target.value);
                setFindIndex(0);
              }}
            />
            <BevelButton aria-label="Previous match" disabled={totalHits < 2} onClick={() => stepHit(-1)}>
              &lt; Prev
            </BevelButton>
            <BevelButton aria-label="Next match" disabled={totalHits < 2} onClick={() => stepHit(1)}>
              Next &gt;
            </BevelButton>
            <span className="article-find__count" aria-live="polite">
              {needle === '' ? '' : totalHits === 0 ? 'No matches' : `${currentHit + 1} of ${totalHits}`}
            </span>
            <BevelButton aria-label="Close find" onClick={closeFind}>
              Close
            </BevelButton>
          </div>
        ) : null}
      </header>
      <div ref={bodyRef} className="article-body">
        <aside className="article-aside">
          {reel.length > 0 ? (
            <MediaReel
              media={reel}
              title={discTitle ?? section.title}
              fallback={(caption) => <Plate kind={section.plate} caption={caption} />}
            />
          ) : (
            <Plate kind={section.plate} caption={`Plate: ${section.title}`} />
          )}
          {facts.length > 0 ? (
            <div className="article-callout">
              <section aria-label="Quick Facts">
                <h2 className="article-callout__title">Quick Facts</h2>
                <ul className="article-callout__list">
                  {facts.map((f, i) => (
                    <li key={i}>
                      {f}
                      {onAddNote ? (
                        <BevelButton
                          className="article-callout__add"
                          aria-label={`Add to Notebook: ${f}`}
                          onClick={() => {
                            onAddNote(section.title, f);
                            setNoteAdded(true);
                          }}
                        >
                          + Note
                        </BevelButton>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {onAddNote ? (
                  <p className="article-callout__added" aria-live="polite">
                    {noteAdded ? 'Added to Notebook.' : ''}
                  </p>
                ) : null}
              </section>
            </div>
          ) : null}
        </aside>
        {section.paragraphs.map((p, i) => (
          <p
            key={i}
            className={[
              'article-paragraph',
              i === 0 ? 'article-paragraph--lead' : '',
              progress?.current === i + 2 ? 'article-paragraph--speaking' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-speaking={progress?.current === i + 2 ? 'true' : undefined}
            aria-current={progress?.current === i + 2 ? 'true' : undefined}
            onDoubleClick={onParagraphDoubleClick}
          >
            {paragraphSegments[i]!.map((seg, j) =>
              seg.sectionId !== undefined ? (
                <button
                  key={j}
                  type="button"
                  className="article-xlink"
                  onClick={() => onSelectSection?.(seg.sectionId!)}
                >
                  {renderPieces(seg.text)}
                </button>
              ) : (
                <Fragment key={j}>{renderPieces(seg.text)}</Fragment>
              ),
            )}
          </p>
        ))}
        {timeline.length > 0 ? (
          <section className="article-chrono" aria-label="Chronology">
            <h2 className="article-chrono__title">Chronology</h2>
            <ol className="article-chrono__strip">
              {timeline.map((t, i) => (
                <li key={i} className="article-chrono__stop">
                  <span className="article-chrono__when">{t.when}</span>
                  <span className="article-chrono__tick" aria-hidden="true" />
                  <span className="article-chrono__event">{t.event}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {onSelectSection && related.length > 0 ? (
          <nav className="article-seealso" aria-label="See Also">
            <h2 className="article-seealso__title">See Also</h2>
            <ul className="article-seealso__list">
              {related.map((r) => (
                <li key={r.section_id}>
                  <a
                    href={`#${r.section_id}`}
                    className="article-seealso__link"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectSection(r.section_id);
                    }}
                  >
                    {r.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
      {citeOpen && discTitle !== undefined ? (
        <CiteDialog section={section} discTitle={discTitle} booklet={booklet} language={language} onClose={() => setCiteOpen(false)} />
      ) : null}
    </article>
  );
}
