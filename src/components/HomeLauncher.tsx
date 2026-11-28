import type { ReactNode } from 'react';
import { playSlideClick } from '../audio/audio';
import type { Theme } from '../library/theme';
import { editionOf } from '../model/editions';
import { pickRandomSection } from '../model/discSearch';
import { ARCHIVE_KEY_STAMP } from '../model/easterEggs';
import type { DiscManifest } from '../model/manifest';
import type { ContinueTarget, MasterySummary } from '../model/mastery';
import type { QuickJumpMode } from '../model/nav';
import { useT } from '../i18n/LocaleContext';
import { BevelButton } from './BevelButton';
import { DidYouKnow } from './DidYouKnow';
import { PackShelf } from './PackShelf';
import { Pinpointer } from './Pinpointer';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './PixelIcon';
import { EngravedWatermarks, HeroArt } from './SplashArt';
import { Window } from './Window';
import '../styles/home.css';
import '../styles/workspace.css';
import '../styles/eastereggs.css';

export interface HomeLauncherProps {
  discs: DiscManifest[];
  onPickDisc: (discId: string) => void;
  /** Opens a disc straight to its first diagram or dungeon. Omit to disable the cards. */
  onQuickJump?: (mode: QuickJumpMode) => void;
  onOpenReadMe?: () => void;
  /** The current theme, and its toggle. Omit the toggle to hide the Utilities card. */
  theme?: Theme;
  onCycleTheme?: () => void;
  /** Opens the Research Notebook. Omit to hide the Utilities card. */
  onOpenNotebook?: () => void;
  /** Opens the Dictionary dialog. Omit to hide the Utilities card. */
  onOpenDictionary?: (word?: string) => void;
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
  /** Whether the built-in demo discs are mounted. */
  demoDiscs?: boolean;
  /** Turns the built-in demo discs on or off. When given, the shelf has a Demo Discs checkbox. */
  onToggleDemoDiscs?: (on: boolean) => void;
  /** Shows the "Archive Key '97" collector stamp in the status bar. */
  archiveKey?: boolean;
  /** Cross-disc progress for the Study Mastery strip. Omit to hide the strip. */
  mastery?: MasterySummary;
  /** Where Continue Studying goes (for its tooltip). */
  continueTo?: ContinueTarget;
  /** Jumps back to the last disc and article. Omit to dim the button. */
  onContinue?: () => void;
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
    <BevelButton className="home-card" title={text} disabled={disabled || !onClick} onClick={() => onClick?.()}>
      <PixelIcon name={icon} size={24} />
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
  onOpenDictionary,
  onOpenNotebook,
  theme = 'classic',
  onCycleTheme,
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
  demoDiscs = true,
  onToggleDemoDiscs,
  archiveKey = false,
  mastery,
  continueTo,
  onContinue,
}: HomeLauncherProps) {
  const noDiscs = discs.length === 0;
  const canTurnOnDemo = onToggleDemoDiscs !== undefined && !demoDiscs;
  const hasDiagrams = discs.some((d) => d.diagrams.length > 0);
  const hasDungeons = discs.some((d) => d.dungeons.length > 0);
  const hasSections = discs.some((d) => d.sections.length > 0);
  const surprise = () => {
    const pick = pickRandomSection(discs, random ?? Math.random);
    if (!pick || !onOpenSection) return;
    playSlideClick();
    onOpenSection(pick.discId, pick.sectionId);
  };
  const edition = editionOf(theme);
  const tr = useT();
  const packs = `${discs.length} Expansion ${discs.length === 1 ? 'Pack' : 'Packs'} Ready`;

  return (
    <Window
      title={tr('home_title')}
      className="home-window"
      maximizable
      defaultMaximized
      draggable
      minimized={minimized}
      onMinimize={onMinimize}
    >
      <div className="home">
        <EngravedWatermarks edition={theme} />
        <header className="home-hero">
          <div className="home-hero__emblem">
            <HeroArt edition={theme} />
          </div>
          <div className="home-hero__text">
            <p className="home-hero__eyebrow">{edition.eyebrow}</p>
            <h1 className="home-hero__title" aria-label="DiscLore '97">
              <span className="home-hero__word" aria-hidden="true">
                DiscLore
              </span>
              <span className="home-hero__num" aria-hidden="true">
                97
              </span>
            </h1>
            <p className="home-hero__tag">encyclopedia</p>
          </div>
          {mastery ? (
            <section className="home-mastery" aria-label={tr('mastery_title')}>
              <p className="home-mastery__title">{tr('mastery_title')}</p>
              <dl className="home-mastery__stats">
                <div className="home-mastery__stat">
                  <dt>{tr('mastery_read')}</dt>
                  <dd>{`${mastery.articlesRead}/${mastery.articlesTotal}`}</dd>
                </div>
                <div className="home-mastery__stat">
                  <dt>{tr('mastery_mastered')}</dt>
                  <dd>{`${mastery.cardsMastered}/${mastery.cardsTotal}`}</dd>
                </div>
                <div className="home-mastery__stat">
                  <dt>{tr('mastery_victories')}</dt>
                  <dd>{mastery.victories}</dd>
                </div>
              </dl>
              <BevelButton
                className="home-mastery__continue"
                disabled={!onContinue}
                title={continueTo ? `Continue: ${continueTo.label}` : 'Open a disc to start; this button brings you back to it.'}
                onClick={() => onContinue?.()}
              >
                {tr('mastery_continue')}
              </BevelButton>
            </section>
          ) : null}
          <p className="home-hero__badge">D: CD-ROM Mounted &bull; Procedural Audio</p>
        </header>

        <div className="home__grid">
          <Group legend={tr('home_packs')} className="home-group--packs">
            {onOpenSection ? (
              <Pinpointer
                discs={discs}
                removableIds={removableIds}
                onOpenSection={onOpenSection}
                onBurnTopic={onBurnSample}
              />
            ) : null}
            <PackShelf
              discs={discs}
              removableIds={removableIds}
              onPick={onPickDisc}
              onSaveDiscImage={onSaveDiscImage}
              onRemoveDisc={onRemoveDisc}
              onBurnSample={onBurnSample}
              sampleBurns={edition.sampleBurns}
              demoDiscs={demoDiscs}
              onToggleDemoDiscs={onToggleDemoDiscs}
              onBurnNew={onBurnNew}
              onMountImage={onMountImage}
            />
            {onOpenSection ? (
              <DidYouKnow
                discs={discs}
                onOpenSection={onOpenSection}
                random={random}
                edition={theme}
                empty={
                  noDiscs ? (
                    <>
                      <p className="spotlight__fact">No facts yet: every fact here comes from a mounted disc.</p>
                      {canTurnOnDemo ? (
                        <div className="spotlight__buttons">
                          <BevelButton className="spotlight__button" onClick={() => onToggleDemoDiscs!(true)}>
                            Turn On Demo Discs
                          </BevelButton>
                        </div>
                      ) : null}
                    </>
                  ) : undefined
                }
              />
            ) : null}
          </Group>

          <div className="home__side">
            <Group legend={tr('home_quickJump')} className="home-group--editorial">
              <div className="home__cards">
                <Card
                  icon="diagram"
                  title={tr('home_diagrams')}
                  text="find and jump straight to pin diagrams"
                  disabled={!hasDiagrams}
                  onClick={onQuickJump ? () => onQuickJump('diagram') : undefined}
                />
                <Card
                  icon="torch"
                  title={tr('home_keepmaze')}
                  text="explore the trivia dungeon"
                  disabled={!hasDungeons}
                  onClick={onQuickJump ? () => onQuickJump('keepmaze') : undefined}
                />
                <Card
                  icon="castle"
                  title={tr('start_tour')}
                  text="a guided walk through a disc, stop by stop"
                  disabled={!hasSections}
                  onClick={onQuickJump ? () => onQuickJump('tour') : undefined}
                />
                <Card
                  icon="key"
                  title={tr('start_flashcards')}
                  text="drill trivia and Quick Facts as index cards"
                  disabled={!hasSections}
                  onClick={onQuickJump ? () => onQuickJump('flashcards') : undefined}
                />
                {onOpenSection ? (
                  <Card
                    icon="book"
                    title={tr('home_surprise')}
                    text={noDiscs ? 'needs a mounted disc' : 'open a random article from any disc'}
                    disabled={!hasSections}
                    onClick={surprise}
                  />
                ) : null}
              </div>
              <p className="home__note">
                {noDiscs
                  ? canTurnOnDemo
                    ? 'No discs are mounted. Burn or mount a disc, or turn on the Demo Discs, to use these.'
                    : 'No discs are mounted. Burn or mount a disc to use these.'
                  : 'Uses the last disc you opened, or the first one.'}
              </p>
            </Group>

            <Group legend={tr('home_utilities')} className="home-group--editorial">
              <div className="home__cards home__cards--grid">
                <Card
                  icon="cd"
                  title={tr('start_burn')}
                  text="burn a Wikipedia topic, GitHub repo, or web page"
                  onClick={onBurnNew}
                />
                {onMountImage ? (
                  <Card
                    icon="cd"
                    title={tr('start_mount')}
                    text="open a disc image saved on this computer"
                    onClick={onMountImage}
                  />
                ) : null}
                {onOpenDictionary ? (
                  <Card
                    icon="book"
                    title={tr('start_dictionary')}
                    text="look up a word on every mounted disc"
                    onClick={() => onOpenDictionary()}
                  />
                ) : null}
                {onOpenNotebook ? (
                  <Card
                    icon="notepad"
                    title={tr('menu_notebook')}
                    text="your study notes for a disc"
                    onClick={() => onOpenNotebook()}
                  />
                ) : null}
                {onCycleTheme ? (
                  <Card
                    icon="torch"
                    title={`Edition: ${edition.name}`}
                    text="switch between Classic, Haunted, and Christmas"
                    onClick={onCycleTheme}
                  />
                ) : null}
                <Card
                  icon="notepad"
                  title={tr('start_readme')}
                  text="what DiscLore '97 and KeepMaze are"
                  onClick={onOpenReadMe}
                />
                <Card
                  icon="key"
                  title={tr('start_replay')}
                  text="watch the boot screen again"
                  onClick={onReplaySplash}
                />
              </div>
            </Group>

            <section className="home-info" aria-labelledby="home-info-title">
              <h2 id="home-info-title" className="home-info__title">
                {tr('home_howItWorks')}
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
          {archiveKey ? (
            <div className="status-bar__panel status-bar__panel--stamp" title="You found the Archive Key.">
              {ARCHIVE_KEY_STAMP}
            </div>
          ) : null}
          <div className="status-bar__panel status-bar__panel--cd">{tr('home_autoplay')}</div>
        </div>
      </div>
    </Window>
  );
}
