import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { playDoorUnlock, playTorch, playVictoryFanfare } from '../audio/audio';
import { gameReducer, initGame, scholarRank, STARTING_TORCHES } from '../model/game';
import type { GameAction, GameState } from '../model/game';
import { ENTRANCE_ROOM_ID } from '../model/manifest';
import type { DiscManifest, Dungeon } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { DungeonViewport } from './DungeonViewport';
import { MiniMap } from './MiniMap';
import { PixelIcon } from './PixelIcon';
import '../styles/keepmaze.css';

export interface KeepMazeUIProps {
  disc: DiscManifest;
  dungeon: Dungeon;
  /** Opens a section in the Article_Viewer. */
  onOpenSection: (sectionId: string) => void;
  /** Injected for tests; defaults to Math.random. */
  rng?: () => number;
}

const PEEK_MAX = 160;

/** First sentence of a paragraph, capped so a hint stays a hint. */
function firstSentence(text: string): string {
  const t = text.trim();
  const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(t);
  const s = m ? m[0] : t;
  return s.length > PEEK_MAX ? `${s.slice(0, PEEK_MAX - 3).trimEnd()}...` : s;
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
  const [visited, setVisited] = useState<string[]>(() => [state.roomId]);
  /** Question whose Peek Hint is open. A new question starts with the hint closed. */
  const [peekId, setPeekId] = useState<string | null>(null);

  // Remember every room entered, for the mini-map.
  useEffect(() => {
    setVisited((v) => (v.includes(state.roomId) ? v : [...v, state.roomId]));
  }, [state.roomId]);

  // Torch sound on every room entry, including the entrance at start.
  useEffect(() => {
    if (started) playTorch();
  }, [started, state.roomId]);

  // Fanfare once, when the throne room is reached.
  useEffect(() => {
    if (state.won) playVictoryFanfare();
  }, [state.won]);

  const noTrivia = questions.length === 0;
  const room = dungeon.rooms.find((r) => r.room_id === state.roomId);
  const locked = !started || state.pending !== null || state.lastWrong !== null;
  const scene = (
    <div className="keepmaze__scene">
      <div className="keepmaze__view">
        {/* Remounts on every room change, which replays the one-shot CSS torchlight pulse. */}
        {started ? <span key={state.roomId} className="keepmaze__torch" aria-hidden="true" /> : null}
        <DungeonViewport
          locked={locked}
          victory={state.won}
          label={state.won ? 'Dungeon view: the way is open' : locked ? 'Dungeon view: a locked door' : 'Dungeon view: a door'}
        />
      </div>
      <div className="keepmaze__map">
        <MiniMap dungeon={dungeon} visited={visited} currentRoomId={state.roomId} />
        <ul className="minimap-legend" aria-label="Mini-map legend">
          <li><span className="minimap-legend__swatch minimap-legend__swatch--current" aria-hidden="true" />Current</li>
          <li><span className="minimap-legend__swatch minimap-legend__swatch--visited" aria-hidden="true" />Visited</li>
          <li><span className="minimap-legend__swatch minimap-legend__swatch--unknown" aria-hidden="true" />Unexplored</li>
        </ul>
      </div>
    </div>
  );

  if (!started) {
    return (
      <div className="keepmaze">
        {scene}
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
    setVisited([ENTRANCE_ROOM_ID]);
  };

  if (state.won) {
    return (
      <div className="keepmaze">
        {scene}
        <section className="certificate" aria-label="Victory Certificate">
          <div className="certificate__inner">
            <p className="certificate__kicker">DiscLore '97 &bull; KeepMaze</p>
            <h2 className="certificate__title">Certificate of Victory</h2>
            <p className="certificate__line">This certifies that the bearer has conquered</p>
            <p className="certificate__dungeon">{dungeon.title}</p>
            <p className="certificate__line">and was seated in the {room?.name ?? 'Throne Room'}.</p>
            <dl className="certificate__stats">
              <div className="certificate__stat">
                <dt>Moves</dt>
                <dd>{state.moves}</dd>
              </div>
              <div className="certificate__stat">
                <dt>Incorrect answers</dt>
                <dd>{state.incorrect}</dd>
              </div>
              <div className="certificate__stat">
                <dt>Score</dt>
                <dd>{state.score}</dd>
              </div>
              <div className="certificate__stat">
                <dt>Best streak</dt>
                <dd>{state.bestStreak}</dd>
              </div>
            </dl>
            <p className="certificate__rank">
              Scholar Rank: <strong>{scholarRank(state.score, state.moves)}</strong>
            </p>
            <p className="keepmaze__message certificate__result" role="status">
              Victory! You reached the throne room in {state.moves} moves with {state.incorrect}{' '}
              incorrect answers.
            </p>
            <svg className="certificate__seal" viewBox="0 0 48 48" role="img" aria-label="Crimson seal">
              <polygon className="certificate__seal-star" points="24,1 30,12 42,8 36,19 47,24 36,29 42,40 30,36 24,47 18,36 6,40 12,29 1,24 12,19 6,8 18,12" />
              <circle className="certificate__seal-ring" cx="24" cy="24" r="12" />
              <text className="certificate__seal-text" x="24" y="24" textAnchor="middle" dominantBaseline="central">
                97
              </text>
            </svg>
          </div>
        </section>
        <BevelButton onClick={restart}>Restart</BevelButton>
      </div>
    );
  }

  const wrongSection = state.lastWrong
    ? disc.sections.find((s) => s.section_id === state.lastWrong?.section_id)
    : undefined;
  const pending = state.pending;
  const peekSection = pending ? disc.sections.find((s) => s.section_id === pending.question.section_id) : undefined;

  const answer = (index: number) => {
    if (!pending) return;
    if (index === pending.question.correct_index) playDoorUnlock();
    dispatch({ type: 'answer', index });
  };

  return (
    <div className="keepmaze">
      {scene}
      <div className="keepmaze__panels">
      <div className="keepmaze__hud">
        <p className="keepmaze__room">{room?.name ?? state.roomId}</p>
        <p className="keepmaze__message">{room?.description}</p>
        <div className="keepmaze__stats">
          <span>Moves: {state.moves}</span>
          <span>Incorrect: {state.incorrect}</span>
          <BevelButton className="keepmaze__restart" onClick={restart}>
            Restart
          </BevelButton>
        </div>
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

      <section className="keepmaze__side quest-card" aria-label="KeepMaze Quest">
        <p className="quest-card__title">KeepMaze Quest</p>
        <div className="quest-card__body">
          <p className="quest-card__objective">
            Reach the Throne Room by unlocking doors with encyclopedia trivia.
          </p>
          <p className="quest-card__progress">
            Rooms explored: {visited.length} of {dungeon.rooms.length}
          </p>
          <dl className="quest-card__stats" aria-label="Knowledge stats">
            <div className="quest-card__stat">
              <dt>Score</dt>
              <dd>{state.score}</dd>
            </div>
            <div className="quest-card__stat">
              <dt>Streak</dt>
              <dd>{state.streak}</dd>
            </div>
            <div className="quest-card__stat">
              <dt>Torches</dt>
              <dd>
                <span className="torches" role="img" aria-label={`${state.torches} of ${STARTING_TORCHES} torches lit`}>
                  {Array.from({ length: STARTING_TORCHES }, (_, i) => (
                    <span key={i} className="torches__torch" data-lit={i < state.torches ? 'true' : 'false'}>
                      <PixelIcon name="torch" />
                    </span>
                  ))}
                </span>
              </dd>
            </div>
          </dl>
      {!pending && !state.lastWrong && (
        <p className="keepmaze__hint">Choose an exit. A trivia question guards each door.</p>
      )}
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
          <BevelButton
            className="keepmaze__peek-button"
            aria-expanded={peekId === pending.question.question_id}
            onClick={() => {
              dispatch({ type: 'peek' });
              setPeekId((id) => (id === pending.question.question_id ? null : pending.question.question_id));
            }}
          >
            Peek Hint
          </BevelButton>
          {peekId === pending.question.question_id && peekSection ? (
            <div className="keepmaze__peek" role="note" aria-label="Hint preview">
              <p className="keepmaze__peek-title">{peekSection.title}</p>
              <p className="keepmaze__peek-text">{firstSentence(peekSection.paragraphs[0] ?? '')}</p>
            </div>
          ) : null}
          {pending.hinted ? (
            <p className="keepmaze__peek-note">Hint used: a right answer is worth 50 points.</p>
          ) : null}
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
        </div>
      </section>
      </div>
    </div>
  );
}
