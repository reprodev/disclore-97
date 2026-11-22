import { useMemo, useState } from 'react';
import { collectFacts } from '../model/discSearch';
import type { DiscManifest } from '../model/manifest';
import { BevelButton } from './BevelButton';
import '../styles/home.css';

export interface DidYouKnowProps {
  discs: DiscManifest[];
  /** Opens a disc straight to a section. */
  onOpenSection: (discId: string, sectionId: string) => void;
  /** [0, 1) generator that picks the first fact. Defaults to Math.random. */
  random?: () => number;
}

/**
 * The Encarta-style "Did You Know?" spotlight: one real fact from a mounted disc, with the
 * disc and article it came from. Next Fact steps through the facts, moving from disc to disc.
 * Open Article jumps to the article that holds it.
 */
export function DidYouKnow({ discs, onOpenSection, random = Math.random }: DidYouKnowProps) {
  const facts = useMemo(() => collectFacts(discs), [discs]);
  const [start] = useState(() => random());
  const [step, setStep] = useState(0);

  if (facts.length === 0) return null;
  const at = (Math.floor(start * facts.length) + step) % facts.length;
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
