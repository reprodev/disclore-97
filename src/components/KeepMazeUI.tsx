import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { playDoorUnlock, playTorch } from '../audio/audio';
import { gameReducer, initGame } from '../model/game';
import type { GameAction, GameState } from '../model/game';
import type { DiscManifest, Dungeon } from '../model/manifest';
import { BevelButton } from './BevelButton';
import '../styles/keepmaze.css';

export interface KeepMazeUIProps {
  disc: DiscManifest;
  dungeon: Dungeon;
  /** Opens a section in the Article_Viewer. */
  onOpenSection: (sectionId: string) => void;
  /** Injected for tests; defaults to Math.random. */
  rng?: () => number;
}

export function KeepMazeUI({ disc, dungeon, onOpenSection, rng = Math.random }: KeepMazeUIProps) {
  const questions = disc.trivia;
  const rngRef = useRef(rng);
  rngRef.current = rng;

  const reducer = useCallback(
    (s: GameState, a: GameAction) => gameReducer(s, a, dungeon, questions, rngRef.current),
    [dungeon, questions],
  );
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initGame(dungeon, questions, rng),
  );
  const [started, setStarted] = useState(false);

  // Torch sound on every room entry, including the entrance at start.
  useEffect(() => {
    if (started) playTorch();
  }, [started, state.roomId]);

  const noTrivia = questions.length === 0;
  const room = dungeon.rooms.find((r) => r.room_id === state.roomId);

  if (!started) {
    return (
      <div className="keepmaze">
        <h2 className="keepmaze__room">{dungeon.title}</h2>
        <BevelButton disabled={noTrivia} onClick={() => setStarted(true)}>
          Start
        </BevelButton>
        {noTrivia && (
          <p className="keepmaze__message" role="status">
            This dungeon needs trivia questions before it can be played.
          </p>
        )}
      </div>
    );
  }

  const restart = () => {
    dispatch({ type: 'restart' });
  };

  if (state.won) {
    return (
      <div className="keepmaze">
        <div className="keepmaze__hud">
          <p className="keepmaze__room">{room?.name ?? 'Throne Room'}</p>
          <p className="keepmaze__message" role="status">
            Victory! You reached the throne room in {state.moves} moves with {state.incorrect}{' '}
            incorrect answers.
          </p>
        </div>
        <BevelButton onClick={restart}>Restart</BevelButton>
      </div>
    );
  }

  const wrongSection = state.lastWrong
    ? disc.sections.find((s) => s.section_id === state.lastWrong?.section_id)
    : undefined;
  const pending = state.pending;

  const answer = (index: number) => {
    if (!pending) return;
    if (index === pending.question.correct_index) playDoorUnlock();
    dispatch({ type: 'answer', index });
  };

  return (
    <div className="keepmaze">
      <div className="keepmaze__hud">
        <p className="keepmaze__room">{room?.name ?? state.roomId}</p>
        <p className="keepmaze__message">{room?.description}</p>
        <p className="keepmaze__stats">
          <span>Moves: {state.moves}</span>
          <span>Incorrect: {state.incorrect}</span>
        </p>
        <div>
          <span>Exits:</span>
          <ul className="keepmaze__list">
            {(room?.exits ?? []).map((exit, i) => {
              const dest = dungeon.rooms.find((r) => r.room_id === exit.to);
              return (
                <li key={`${exit.to}-${i}`}>
                  <BevelButton
                    disabled={pending !== null}
                    onClick={() => dispatch({ type: 'selectExit', to: exit.to })}
                  >
                    {dest?.name ?? exit.to}
                  </BevelButton>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {pending && (
        <div className="keepmaze__question" role="group" aria-label="Trivia question">
          <p className="keepmaze__message">{pending.question.prompt}</p>
          <ul className="keepmaze__options">
            {pending.question.options.map((opt, i) => (
              <li key={i}>
                <BevelButton onClick={() => answer(i)}>{opt}</BevelButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.lastWrong && (
        <div className="keepmaze__question" role="status">
          <p className="keepmaze__message">
            Incorrect. The door stays locked.
            {wrongSection && <> See: {wrongSection.title}.</>}
          </p>
          <button
            type="button"
            className="keepmaze__link"
            onClick={() => onOpenSection(state.lastWrong!.section_id)}
          >
            Open {wrongSection ? `"${wrongSection.title}"` : 'section'} in the article viewer
          </button>
        </div>
      )}

      <BevelButton onClick={restart}>Restart</BevelButton>
    </div>
  );
}
