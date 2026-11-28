import { useEffect, useMemo } from 'react';
import { playSlideClick } from '../audio/audio';
import { buildFlashcards, flipCard, gotIt, initDeck, isComplete, needReview, restartDeck } from '../model/flashcards';
import type { DeckState } from '../model/flashcards';
import type { DiscManifest } from '../model/manifest';
import { useLocale } from '../i18n/LocaleContext';
import { discTextAttrs } from '../model/languages';
import { BevelButton } from './BevelButton';
import '../styles/flashcards.css';

export interface FlashcardsViewProps {
  disc: DiscManifest;
  /** Progress through the deck, owned by the app so it survives "Open Source Article" and Back. Null starts a fresh deck. */
  deck: DeckState | null;
  onDeck: (next: DeckState) => void;
  /** Opens the article a card came from. */
  onOpenSection: (sectionId: string) => void;
}

const TYPING = /^(?:button|input|textarea|select|a)$/i;

/**
 * Study Flashcards: a 1997 index-card deck made from the disc's trivia and Quick Facts.
 * Flip the card (button or Space), then mark it Got It (mastered) or Need Review (it comes back
 * a few cards later). When every card is mastered, Restart Deck starts again.
 */
export function FlashcardsView({ disc, deck, onDeck, onOpenSection }: FlashcardsViewProps) {
  const discLang = discTextAttrs(disc.language, useLocale());
  const cards = useMemo(() => buildFlashcards(disc), [disc]);
  const state = deck ?? initDeck(cards);
  const total = cards.length;
  const currentId = state.queue[0];
  const current = cards.find((c) => c.id === currentId);
  const complete = isComplete(state, total);
  const position = current ? cards.indexOf(current) + 1 : total;

  const update = (next: DeckState) => onDeck(next);
  const flip = () => {
    playSlideClick();
    update(flipCard(state));
  };

  // Space turns the card over, unless a button or field has the focus or a dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && (TYPING.test(e.target.tagName) || e.target.closest('[contenteditable="true"]'))) return;
      if (document.querySelector('.modal-layer')) return;
      if (!current) return;
      e.preventDefault();
      playSlideClick();
      onDeck(flipCard(state));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current, state, onDeck]);

  if (total === 0) {
    return (
      <section className="flashcards" aria-label="Study Flashcards" {...discLang}>
        <h1 className="flashcards__title">Study Flashcards</h1>
        <p className="flashcards__empty">This disc has nothing to study yet.</p>
      </section>
    );
  }

  return (
    <section className="flashcards" aria-label="Study Flashcards" {...discLang}>
      <p className="flashcards__kicker">Study Flashcards &bull; {disc.title}</p>
      <p className="flashcards__status" aria-live="polite">
        Card {position} of {total} &bull; Mastered: {state.mastered.length} / {total}
      </p>

      {complete ? (
        <div className="flashcards__card flashcards__card--done" role="group" aria-label="Deck complete">
          <h1 className="flashcards__title">Deck complete!</h1>
          <p className="flashcards__text">
            You mastered all {total} cards on {disc.title}.
          </p>
        </div>
      ) : current ? (
        <div className="flashcards__card" role="group" aria-label={state.flipped ? 'Card answer' : 'Card question'} data-side={state.flipped ? 'back' : 'front'}>
          <p className="flashcards__side">{state.flipped ? 'Answer' : current.kind === 'trivia' ? 'Question' : 'Recall'}</p>
          <p className="flashcards__text">{state.flipped ? current.back : current.front}</p>
          <p className="flashcards__hint">From: {current.hint}</p>
        </div>
      ) : null}

      <div className="flashcards__buttons" role="group" aria-label="Flashcard controls">
        {complete ? (
          <BevelButton onClick={() => update(restartDeck(cards))}>Restart Deck</BevelButton>
        ) : (
          <>
            <BevelButton quiet onClick={flip}>
              Flip Card
            </BevelButton>
            <BevelButton disabled={!state.flipped} onClick={() => update(needReview(state))}>
              Need Review
            </BevelButton>
            <BevelButton disabled={!state.flipped} onClick={() => update(gotIt(state))}>
              Got It
            </BevelButton>
            {current ? <BevelButton onClick={() => onOpenSection(current.section_id)}>Open Source Article</BevelButton> : null}
          </>
        )}
      </div>
      {!complete ? <p className="flashcards__tip">Press Space to flip the card.</p> : null}
    </section>
  );
}
