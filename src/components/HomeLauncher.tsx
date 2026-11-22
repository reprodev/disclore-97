import type { ReactNode } from 'react';
import { playSlideClick } from '../audio/audio';
import { pickRandomSection } from '../model/discSearch';
import type { DiscManifest } from '../model/manifest';
import type { QuickJumpMode } from '../model/nav';
import { BevelButton } from './BevelButton';
import { DidYouKnow } from './DidYouKnow';
import { PackShelf } from './PackShelf';
import { Pinpointer } from './Pinpointer';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './PixelIcon';
import { HeroArt } from './SplashArt';
import { Window } from './Window';
import '../styles/home.css';
import '../styles/workspace.css';

export interface HomeLauncherProps {
  discs: DiscManifest[];
  onPickDisc: (discId: string) => void;
  /** Opens a disc straight to its first diagram or dungeon. Omit to disable the cards. */
  onQuickJump?: (mode: QuickJumpMode) => void;
  onOpenReadMe?: () => void;
  onReplaySplash?: () => void;
  /** Opens the Burn dialog. Omit to disable the card. */
  onBurnNew?: () => void;
  /** Opens the file picker to mount a .json disc image. Omit to hide the card. */
  onMountImage?: () => void;
  /** Opens a disc straight to a section. Powers the Pinpointer, Did You Know?, and Surprise Me!. Omit to hide them. */
  onOpenSection?: (discId: string, sectionId: string) => void;
  /** [0, 1) generator for Surprise Me! and the first spotlight fact. Defaults to Math.random. */
  random?: () => number;
  /** Ids of burned or mounted discs: they get the Burned CD-Rs tab, Save .json, and Eject. */
  removableIds?: ReadonlySet<string>;
  /** Exports a burned disc as a .json disc image. */
  onSaveDiscImage?: (disc: DiscManifest) => void;
  /** Removes a burned disc from the library. */
  onRemoveDisc?: (discId: string) => void;
  /** Burns a sample disc about a topic (the quick-start buttons on the empty Burned CD-Rs tab). */
  onBurnSample?: (topic: string) => void;
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

function Group({ legend, className, children }: { legend: string; className?: string; children: ReactNode }) {
  return (
    <fieldset className={className ? `groupbox home-group ${className}` : 'groupbox home-group'}>
      <legend className="groupbox__legend">{legend}</legend>
      {children}
    </fieldset>
  );
}

const HOW_IT_WORKS: { icon: IconName; term: string; text: string }[] = [
  {
    icon: 'diagram',
    term: 'Interactive SVG Hotspots',
    text: 'Click a numbered pin to open its article.',
  },
  {
    icon: 'torch',
    term: 'KeepMaze BFS Dungeons',
    text: 'Every dungeon is checked, so the exit is reachable.',
  },
  {
    icon: 'speaker',
    term: 'Procedural WebAudio',
    text: 'All sound is made live. No audio files.',
  },
];

/** Stage 2: the "DiscLore '97 Home" window. */
export function HomeLauncher({
  discs,
  onPickDisc,
  onQuickJump,
  onOpenReadMe,
  onReplaySplash,
  onBurnNew,
  onMountImage,
  onOpenSection,
  random,
  removableIds,
  onSaveDiscImage,
  onRemoveDisc,
  onBurnSample,
  minimized = false,
  onMinimize,
}: HomeLauncherProps) {
  const hasDiagrams = discs.some((d) => d.diagrams.length > 0);
  const hasDungeons = discs.some((d) => d.dungeons.length > 0);
  const hasSections = discs.some((d) => d.sections.length > 0);
  const surprise = () => {
    const pick = pickRandomSection(discs, random ?? Math.random);
    if (!pick || !onOpenSection) return;
    playSlideClick();
    onOpenSection(pick.discId, pick.sectionId);
  };
  const packs = `${discs.length} Expansion ${discs.length === 1 ? 'Pack' : 'Packs'} Ready`;

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
        <header className="home-hero">
          <div className="home-hero__emblem">
            <HeroArt />
          </div>
          <div className="home-hero__text">
            <h1 className="home-hero__title">DiscLore '97</h1>
            <p className="home-hero__subtitle">Multimedia Encyclopedia &bull; 1997 Edition</p>
          </div>
          <p className="home-hero__badge">D: CD-ROM Mounted &bull; Procedural Audio</p>
        </header>

        <div className="home__grid">
          <Group legend="Expansion Packs (CD-ROM Drive D:)" className="home-group--packs">
            {onOpenSection ? (
              <Pinpointer discs={discs} removableIds={removableIds} onOpenSection={onOpenSection} />
            ) : null}
            <PackShelf
              discs={discs}
              removableIds={removableIds}
              onPick={onPickDisc}
              onSaveDiscImage={onSaveDiscImage}
              onRemoveDisc={onRemoveDisc}
              onBurnSample={onBurnSample}
            />
            {onOpenSection ? <DidYouKnow discs={discs} onOpenSection={onOpenSection} random={random} /> : null}
          </Group>

          <div className="home__side">
            <Group legend="Quick Jump Modes" className="home-group--editorial">
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
                {onOpenSection ? (
                  <Card
                    icon="book"
                    title="Surprise Me!"
                    text="Open a random article from any disc."
                    disabled={!hasSections}
                    onClick={surprise}
                  />
                ) : null}
              </div>
              <p className="home__note">Uses the last disc you opened, or the first one.</p>
            </Group>

            <Group legend="Utilities" className="home-group--editorial">
              <div className="home__cards">
                <Card
                  icon="cd"
                  title="Burn New CD-R Disc..."
                  text="Turn a GitHub repo, web page, or topic into a disc."
                  onClick={onBurnNew}
                />
                {onMountImage ? (
                  <Card
                    icon="cd"
                    title="Mount Disc Image (.json)..."
                    text="Open a disc you saved earlier, from a file on this computer."
                    onClick={onMountImage}
                  />
                ) : null}
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

            <section className="home-info" aria-labelledby="home-info-title">
              <h2 id="home-info-title" className="home-info__title">
                How DiscLore '97 Works
              </h2>
              <dl className="home-info__list">
                {HOW_IT_WORKS.map((item) => (
                  <div key={item.term} className="home-info__row">
                    <PixelIcon name={item.icon} size={16} />
                    <div>
                      <dt>{item.term}</dt>
                      <dd>{item.text}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>

        <div className="status-bar home-status" role="group" aria-label="Home status bar">
          <div className="status-bar__panel status-bar__panel--disc">DiscLore '97 Home</div>
          <div className="status-bar__panel status-bar__panel--view">{packs}</div>
          <div className="status-bar__panel status-bar__panel--cd">CD-ROM: AutoPlay Ready</div>
        </div>
      </div>
    </Window>
  );
}
