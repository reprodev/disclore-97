import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { collectFacts } from '../model/discSearch';
import { prefersDisc } from '../model/editions';
import type { Theme } from '../model/editions';
import type { DiscManifest } from '../model/manifest';
import { BevelButton } from './BevelButton';
import '../styles/home.css';

export interface DidYouKnowProps {
  discs: DiscManifest[];
  /** Opens a disc straight to a section. */
  onOpenSection: (discId: string, sectionId: string) => void;
  /** [0, 1) generator that picks the first fact. Defaults to Math.random. */
  random?: () => number;
  /** The active edition. The first fact comes from a disc that suits it, when one is mounted. */
  edition?: Theme;
  /**
   * Shown in the box when there are no facts at all, for example with no discs mounted. Without it the
   * box is simply left out.
   */
  empty?: ReactNode;
}

/**
 * The Encarta-style "Did You Know?" spotlight: one real fact from a mounted disc, with the
 * disc and article it came from. Next Fact steps through the facts, moving from disc to disc.
 * Open Article jumps to the article that holds it.
 */
export function DidYouKnow({ discs, onOpenSection, random = Math.random, edition = 'classic', empty }: DidYouKnowProps) {
  const facts = useMemo(() => collectFacts(discs), [discs]);
  const [start] = useState(() => random());
  const [step, setStep] = useState(0);

  if (facts.length === 0) {
    if (empty === undefined) return null;
    return (
      <section className="spotlight spotlight--empty" aria-label="Did You Know?">
        <h2 className="spotlight__title">Did You Know?</h2>
        {empty}
      </section>
    );
  }
  // Start from a fact of an edition-themed disc when there is one. Next Fact then walks every disc as usual.
  const themed = facts.flatMap((f, i) => (prefersDisc(edition, f.discId, f.discTitle) ? [i] : []));
  const base = themed.length > 0 ? themed[Math.min(themed.length - 1, Math.floor(start * themed.length))]! : Math.floor(start * facts.length);
  const at = (base + step) % facts.length;
  const fact = facts[at]!;

  return (
    <section className="spotlight" aria-label="Did You Know?">
      <h2 className="spotlight__title">Did You Know?</h2>
      <p className="spotlight__fact">{fact.text}</p>
      <p className="spotlight__source">
        From <cite>{fact.sectionTitle}</cite> in {fact.discTitle}
      </p>
      <div className="spotlight__buttons">
        <BevelButton className="spotlight__button" onClick={() => setStep((s) => s + 1)} disabled={facts.length < 2}>
          Next Fact
        </BevelButton>
        <BevelButton className="spotlight__button" onClick={() => onOpenSection(fact.discId, fact.sectionId)}>
          Open Article
        </BevelButton>
      </div>
    </section>
  );
}
