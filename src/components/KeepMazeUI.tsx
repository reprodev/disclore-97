import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { playDoorUnlock, playTorch, playVictoryFanfare, playWoodKnock } from '../audio/audio';
import { loadBest, saveBest } from '../library/best';
import type { StorageLike } from '../library/discLibrary';
import { torchWhisper } from '../model/easterEggs';
import { beatsBest, gameReducer, initGame, scholarRank, STARTING_TORCHES } from '../model/game';
import type { PersonalBest } from '../model/game';
import type { GameAction, GameState } from '../model/game';
import { ENTRANCE_ROOM_ID } from '../model/manifest';
import type { DiscManifest, Dungeon } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { DungeonViewport, roomVariant } from './DungeonViewport';
import { MiniMap } from './MiniMap';
import { PixelIcon } from './PixelIcon';
import '../styles/keepmaze.css';
import '../styles/eastereggs.css';

export interface KeepMazeUIProps {
  disc: DiscManifest;
  dungeon: Dungeon;
  /** Opens a section in the Article_Viewer. */
  onOpenSection: (sectionId: string) => void;
  /** Where the disc's Personal Best is kept. Without it, no best is recorded or shown. */
  storage?: StorageLike;
  /** Injected for tests; defaults to Math.random. */
  rng?: () => number;
}

const PEEK_MAX = 160;

/** Answer strip letters, as on a 1997 quiz card. Options past the fourth fall back to numbers. */
const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/** First sentence of a paragraph, capped so a hint stays a hint. */
function firstSentence(text: string): string {
  const t = text.trim();
  const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(t);
  const s = m ? m[0] : t;
  return s.length > PEEK_MAX ? `${s.slice(0, PEEK_MAX - 3).trimEnd()}...` : s;
}

export function KeepMazeUI({ disc, dungeon, onOpenSection, storage, rng = Math.random }: KeepMazeUIProps) {
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
  /**
   * Easter egg: tapping the torch rack knocks softly and rotates a dungeon whisper in the panel's
   * caption bar. It is local to the view and never touches the score, the streak, or the torches.
   */
  const [torchTaps, setTorchTaps] = useState(0);
  const tapTorches = () => {
    playWoodKnock();
    setTorchTaps((n) => n + 1);
  };
  const whisper = torchTaps > 0 ? torchWhisper(torchTaps - 1) : null;
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

  /** The disc's best run so far, and whether the run just finished set it. */
  const [best, setBest] = useState<PersonalBest | null>(() => loadBest(storage, disc.disc_id));
  const [newBest, setNewBest] = useState(false);
  const scoreRef = useRef(state);
  scoreRef.current = state;

  // Record the run when the throne room is reached: a higher score, or the same score with a better rank.
  useEffect(() => {
    if (!state.won) {
      setNewBest(false);
      return;
    }
    if (!storage) return;
    const run = scoreRef.current;
    const rank = scholarRank(run.score, run.moves);
    const prev = loadBest(storage, disc.disc_id);
    if (beatsBest(prev, run.score, rank)) {
      const next = { bestScore: run.score, bestRank: rank };
      saveBest(storage, disc.disc_id, next);
      setBest(next);
      setNewBest(true);
    } else {
      setBest(prev);
      setNewBest(false);
    }
  }, [state.won, storage, disc.disc_id]);

  const noTrivia = questions.length === 0;
  const room = dungeon.rooms.find((r) => r.room_id === state.roomId);
  const locked = !started || state.pending !== null || state.lastWrong !== null;

  /** Top hero stage: the room panorama across the full width. */
  const stage = (
    <div className="keepmaze__stage">
      {/* Remounts on every room change, which replays the one-shot CSS torchlight pulse. */}
      {started ? <span key={state.roomId} className="keepmaze__torch" aria-hidden="true" /> : null}
      <DungeonViewport
        locked={locked}
        victory={state.won}
        variant={roomVariant(room)}
        label={state.won ? 'Dungeon view: the way is open' : locked ? 'Dungeon view: a locked door' : 'Dungeon view: a door'}
      />
    </div>
  );

  /**
   * Left HUD cluster: the mini-map with its legend and progress, beside the torch rack and the Score
   * Medallion. These are the only Score, Streak, Torches, and Personal Best on screen.
   */
  const hud = (
    <div className="keepmaze__hud-cluster">
      <div className="keepmaze__map">
        <MiniMap dungeon={dungeon} visited={visited} currentRoomId={state.roomId} />
        <ul className="minimap-legend" aria-label="Mini-map legend">
          <li><span className="minimap-legend__swatch minimap-legend__swatch--current" aria-hidden="true" />Current</li>
          <li><span className="minimap-legend__swatch minimap-legend__swatch--visited" aria-hidden="true" />Visited</li>
          <li><span className="minimap-legend__swatch minimap-legend__swatch--unknown" aria-hidden="true" />Unexplored</li>
        </ul>
        <p className="quest-card__progress">
          Rooms explored: {visited.length} of {dungeon.rooms.length}
        </p>
      </div>
      <div className="keepmaze__trophy">
        <dl className="quest-card__stats medallion" aria-label="Knowledge stats">
          <div className="quest-card__stat torch-rack" data-tappable="true" title="Tap the torches" onClick={tapTorches}>
            <dt>Torches</dt>
            <dd>
              <span className="torches" role="img" aria-label={`${state.torches} of ${STARTING_TORCHES} torches lit`}>
                {Array.from({ length: STARTING_TORCHES }, (_, i) => (
                  <span key={i} className="torches__torch torch-rack__slot" data-lit={i < state.torches ? 'true' : 'false'}>
                    <PixelIcon name="torch" size={24} />
                  </span>
                ))}
              </span>
            </dd>
          </div>
          <svg className="medallion__coin" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <circle cx={16} cy={16} r={15} className="medallion__rim" />
            <circle cx={16} cy={16} r={11} className="medallion__face" />
            <text x={16} y={17} textAnchor="middle" dominantBaseline="central" className="medallion__letter">
              P
            </text>
          </svg>
          <div className="quest-card__stat medallion__score">
            <dt>Score</dt>
            <dd>{state.score}</dd>
          </div>
          <div className="quest-card__stat medallion__streak">
            <dt>Streak</dt>
            <dd>{state.streak}</dd>
          </div>
        </dl>
        {best ? (
          <p className="quest-card__best medallion__best">
            Personal Best: {best.bestScore} pts ({best.bestRank})
          </p>
        ) : (
          <p className="medallion__best medallion__best--none">No best yet</p>
        )}
      </div>
    </div>
  );

  /** The right main panel: one warm ivory manuscript card with a navy caption bar and gold and burgundy trim. */
  const panel = (body: ReactNode, mode: 'welcome' | 'room' | 'question') => (
    <div className="keepmaze__panel" data-mode={mode}>
      <p className="quest-card__title">KeepMaze Quest</p>
      {whisper ? (
        <span className="keepmaze__whisper" aria-live="polite">
          {whisper}
        </span>
      ) : null}
      <div className="keepmaze__panel-body">{body}</div>
    </div>
  );

  /** Bottom console strip: the HUD cluster beside the main panel. */
  const consoleStrip = (body: ReactNode, mode: 'welcome' | 'room' | 'question') => (
    <section className="keepmaze__console quest-card" aria-label="KeepMaze Quest">
      {hud}
      {panel(body, mode)}
    </section>
  );

  if (!started) {
    return (
      <div className="keepmaze">
        {stage}
        {consoleStrip(
          <div className="keepmaze__welcome">
            <p className="keepmaze__kicker">Welcome to KeepMaze</p>
            <h2 className="keepmaze__room keepmaze__dungeon-title">{dungeon.title}</h2>
            <p className="quest-card__objective">
              Reach the Throne Room by unlocking doors with encyclopedia trivia.
            </p>
            <BevelButton className="keepmaze__start" disabled={noTrivia} onClick={() => setStarted(true)}>
              Start
            </BevelButton>
            {noTrivia && (
              <p className="keepmaze__message" role="status">
                This dungeon needs trivia questions before it can be played.
              </p>
            )}
          </div>,
          'welcome',
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
        {stage}
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
            {newBest ? <p className="certificate__best-badge">New Personal Best!</p> : null}
            {best ? (
              <p className="certificate__best">
                Personal Best: {best.bestScore} pts ({best.bestRank})
              </p>
            ) : null}
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
          <div className="certificate__actions">
            <BevelButton onClick={restart}>Restart</BevelButton>
          </div>
        </section>
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

  const roomCard = (
    <div className="keepmaze__room-card">
      <p className="keepmaze__room">{room?.name ?? state.roomId}</p>
      <p className="keepmaze__message keepmaze__description">{room?.description}</p>
      <div className="keepmaze__stats">
        <span>Moves: {state.moves}</span>
        <span>Incorrect: {state.incorrect}</span>
        <BevelButton className="keepmaze__restart" onClick={restart}>
          Restart
        </BevelButton>
      </div>
      <div className="keepmaze__exits">
        <span className="keepmaze__exits-label">Exits:</span>
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
  );

  /**
   * During a question the room card folds into one row, so the Q card and all four answers fit on
   * screen: the room name, Moves, Incorrect, and Restart. The exits come back once the door is decided.
   */
  const questionHeader = (
    <div className="keepmaze__qheader">
      <p className="keepmaze__qheader-line">
        <span className="keepmaze__room">{room?.name ?? state.roomId}</span>
        <span className="keepmaze__qheader-sep" aria-hidden="true">
          {'•'}
        </span>
        <span>Moves: {state.moves}</span>
        <span className="keepmaze__qheader-sep" aria-hidden="true">
          {'•'}
        </span>
        <span>Incorrect: {state.incorrect}</span>
      </p>
      <BevelButton className="keepmaze__restart" onClick={restart}>
        Restart
      </BevelButton>
    </div>
  );

  return (
    <div className="keepmaze">
      {stage}
      {consoleStrip(
        <>
          {pending ? questionHeader : roomCard}
          {!pending && !state.lastWrong && (
            <p className="keepmaze__hint">Choose an exit. A trivia question guards each door.</p>
          )}
          {pending && (
            <div className="keepmaze__question keepmaze__question--manuscript" role="group" aria-label="Trivia question">
              {/* Illuminated drop cap. A span, not a <p>, so the prompt stays the group's first paragraph. */}
              <span className="keepmaze__dropcap" aria-hidden="true">
                Q
              </span>
              <p className="keepmaze__message keepmaze__prompt">{pending.question.prompt}</p>
              <ul className="keepmaze__options">
                {pending.question.options.map((opt, i) => (
                  <li key={i}>
                    <BevelButton className="keepmaze__option" onClick={() => answer(i)}>
                      {/* The letter badge is hidden from the accessible name, so the button is named by its option text. */}
                      <span className="keepmaze__letter" aria-hidden="true">
                        {`${OPTION_LETTERS[i] ?? String(i + 1)}.`}
                      </span>
                      {opt}
                    </BevelButton>
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
            <div className="keepmaze__question keepmaze__wrong" role="status">
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
        </>,
        pending ? 'question' : 'room',
      )}
    </div>
  );
}
