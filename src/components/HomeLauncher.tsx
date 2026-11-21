import type { ReactNode } from 'react';
import type { DiscManifest } from '../model/manifest';
import type { QuickJumpMode } from '../model/nav';
import { BevelButton } from './BevelButton';
import { ExpansionPackList } from './ExpansionPackList';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './PixelIcon';
import { Window } from './Window';
import '../styles/home.css';

export interface HomeLauncherProps {
  discs: DiscManifest[];
  onPickDisc: (discId: string) => void;
  /** Opens a disc straight to its first diagram or dungeon. Omit to disable the cards. */
  onQuickJump?: (mode: QuickJumpMode) => void;
  onOpenReadMe?: () => void;
  onReplaySplash?: () => void;
  /** Hides the Home window without closing it. The parent owns this state. */
  minimized?: boolean;
  onMinimize?: () => void;
}

function Card({
  icon,
  title,
  text,
  disabled,
  onClick,
}: {
  icon: IconName;
  title: string;
  text: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <BevelButton className="home-card" disabled={disabled || !onClick} onClick={() => onClick?.()}>
      <PixelIcon name={icon} size={32} />
      <span className="home-card__text">
        <span className="home-card__title">{title}</span>
        <span className="home-card__desc">{text}</span>
      </span>
    </BevelButton>
  );
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="groupbox home-group">
      <legend className="groupbox__legend">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Stage 2: the "DiscLore '97 Home" window with Expansion Packs, Quick Jump Modes, and Utilities. */
export function HomeLauncher({
  discs,
  onPickDisc,
  onQuickJump,
  onOpenReadMe,
  onReplaySplash,
  minimized = false,
  onMinimize,
}: HomeLauncherProps) {
  const hasDiagrams = discs.some((d) => d.diagrams.length > 0);
  const hasDungeons = discs.some((d) => d.dungeons.length > 0);

  return (
    <Window
      title="DiscLore '97 Home"
      className="home-window"
      maximizable
      defaultMaximized
      draggable
      minimized={minimized}
      onMinimize={onMinimize}
    >
      <div className="home">
        <header className="home__header">
          <PixelIcon name="cd" size={32} />
          <div>
            <h1 className="home__title">Welcome to DiscLore '97</h1>
            <p className="home__subtitle">Pick an Expansion Pack, jump straight in, or read the notes.</p>
          </div>
        </header>

        <div className="home__grid">
          <Group legend="Expansion Packs (CD-ROM Drive D:)">
            {discs.length === 0 ? <p className="home__empty">No discs are available.</p> : null}
            <ExpansionPackList discs={discs} onPick={onPickDisc} />
          </Group>

          <div className="home__side">
            <Group legend="Quick Jump Modes">
              <div className="home__cards">
                <Card
                  icon="diagram"
                  title="Interactive Diagrams"
                  text="Go straight to a diagram and click its numbered pins."
                  disabled={!hasDiagrams}
                  onClick={onQuickJump ? () => onQuickJump('diagram') : undefined}
                />
                <Card
                  icon="torch"
                  title="KeepMaze Quest"
                  text="Go straight into the trivia dungeon."
                  disabled={!hasDungeons}
                  onClick={onQuickJump ? () => onQuickJump('keepmaze') : undefined}
                />
              </div>
              <p className="home__note">Uses the last disc you opened, or the first one.</p>
            </Group>

            <Group legend="Utilities">
              <div className="home__cards">
                <Card
                  icon="notepad"
                  title="About / ReadMe.txt"
                  text="What DiscLore '97 and KeepMaze are."
                  onClick={onOpenReadMe}
                />
                <Card
                  icon="key"
                  title="Replay Intro Splash"
                  text="Watch the boot screen again."
                  onClick={onReplaySplash}
                />
              </div>
            </Group>
          </div>
        </div>
      </div>
    </Window>
  );
}
