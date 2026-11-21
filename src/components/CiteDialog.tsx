import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Section } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { useModalDialog } from './useModalDialog';
import { Window } from './Window';
import '../styles/article.css';

/** Encyclopedia-style citation: `"Section Title." DiscLore '97: Disc Title.` */
export function formatCitation(sectionTitle: string, discTitle: string): string {
  return `"${sectionTitle}." DiscLore '97: ${discTitle}.`;
}

export interface CiteDialogProps {
  section: Section;
  discTitle: string;
  onClose: () => void;
}

type CopyState = 'idle' | 'copied' | 'manual';

/**
 * Modal "Cite / Print Preview" dialog: shows the citation and a page-style
 * preview of the article, with a Copy Citation button.
 */
export function CiteDialog({ section, discTitle, onClose }: CiteDialogProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const [copy, setCopy] = useState<CopyState>('idle');
  const citation = formatCitation(section.title, discTitle);

  const cancel = useCallback(() => onClose(), [onClose]);
  useModalDialog(layerRef, cancel, true);

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
      <Window title="Cite / Print Preview" className="cite-dialog" modal onClose={cancel}>
        <div className="cite-dialog__body">
          <label htmlFor="cite-text" className="cite-dialog__label">
            Citation
          </label>
          <textarea
            id="cite-text"
            ref={textRef}
            className="cite-dialog__text"
            rows={2}
            readOnly
            value={citation}
          />
          <div className="cite-dialog__page" aria-label="Print preview">
            <p className="cite-dialog__running">DiscLore '97 &bull; {discTitle}</p>
            <h2 className="cite-dialog__heading">{section.title}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="cite-dialog__para">
                {p}
              </p>
            ))}
            <p className="cite-dialog__foot">{citation}</p>
          </div>
          <div className="cite-dialog__buttons">
            <span className="cite-dialog__note" aria-live="polite">
              {copy === 'copied' ? 'Citation copied.' : copy === 'manual' ? 'Press Ctrl+C to copy.' : ''}
            </span>
            <BevelButton onClick={() => void copyCitation()}>Copy Citation</BevelButton>
            <BevelButton onClick={cancel}>Close</BevelButton>
          </div>
        </div>
      </Window>
    </div>,
    host,
  );
}
