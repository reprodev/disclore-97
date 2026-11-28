import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { playClick, playSpinUp } from '../audio/audio';
import { shortDiscTitle } from '../library/notebook';
import type { DiscManifest } from '../model/manifest';
import { MessageDialog } from './MessageDialog';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './PixelIcon';
import '../styles/shortcuts.css';

/**
 * Built-in disc shortcuts. They are off by default so the desktop stays clean (the discs are one click
 * away on Home); with discShortcuts on, each is shown while its disc is loaded.
 */
const DISC_SHORTCUTS: { discId: string; label: string; icon: IconName }[] = [
  { discId: 'castles', label: "Castles '97", icon: 'castle' },
  { discId: 'retro-dialup', label: "Retro '97", icon: 'computer' },
];

export interface DesktopIconsProps {
  discs: DiscManifest[];
  onOpenDisc: (discId: string) => void;
  onOpenReadMe: () => void;
  /** Disc ids whose notes are pinned to the desktop. Each mounted one gets a Notes.txt shortcut. */
  pinnedNotes?: readonly string[];
  /** Opens the Research Notebook on a disc's notes. */
  onOpenNotes?: (discId: string) => void;
  /** Opens the Burn New CD-R Disc dialog. Omit to hide the Burn CD-R shortcut. */
  onBurnNew?: () => void;
  /** Opens the Dictionary. Omit to hide the Dictionary shortcut. */
  onOpenDictionary?: () => void;
  /** Shows the built-in disc shortcuts (Castles '97, Retro '97). Off by default. */
  discShortcuts?: boolean;
}

/** What the Recycle Bin says when it is opened. */
export const RECYCLE_BIN_MESSAGE = 'Recycle Bin is empty \u2014 nothing from 1997 is ever truly thrown away.';

interface Shortcut {
  id: string;
  label: string;
  icon: IconName;
  open: () => void;
}

/**
 * Win95 desktop shortcuts in a left column. Click selects, double-click or
 * Enter opens. Labels are white on the teal desktop.
 */
export function DesktopIcons({
  discs,
  onOpenDisc,
  onOpenReadMe,
  pinnedNotes = [],
  onOpenNotes,
  onBurnNew,
  onOpenDictionary,
  discShortcuts = false,
}: DesktopIconsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [recycleOpen, setRecycleOpen] = useState(false);

  const shortcuts: Shortcut[] = [
    ...(discShortcuts ? DISC_SHORTCUTS : []).filter((s) => discs.some((d) => d.disc_id === s.discId)).map((s) => ({
      id: s.discId,
      label: s.label,
      icon: s.icon,
      open: () => {
        playSpinUp();
        onOpenDisc(s.discId);
      },
    })),
    ...(onBurnNew
      ? [
          {
            id: 'burn',
            label: 'Burn CD-R',
            icon: 'cd' as IconName,
            open: () => {
              playClick();
              onBurnNew();
            },
          },
        ]
      : []),
    ...(onOpenDictionary
      ? [
          {
            id: 'dictionary',
            label: 'Dictionary',
            icon: 'book' as IconName,
            open: () => {
              playClick();
              onOpenDictionary();
            },
          },
        ]
      : []),
    {
      id: 'readme',
      label: 'ReadMe.txt',
      icon: 'notepad',
      open: () => {
        playClick();
        onOpenReadMe();
      },
    },
    // Pinned notebooks, in the order they were pinned. A pin for a disc that is not mounted shows nothing.
    ...(onOpenNotes
      ? pinnedNotes.flatMap((id) => {
          const d = discs.find((x) => x.disc_id === id);
          if (!d) return [];
          return [
            {
              id: `notes:${id}`,
              label: `${shortDiscTitle(d.title)} Notes.txt`,
              icon: 'notepad' as IconName,
              open: () => {
                playClick();
                onOpenNotes(id);
              },
            },
          ];
        })
      : []),
    // The Recycle Bin always sits last, as on a Win95 desktop.
    {
      id: 'recycle',
      label: 'Recycle Bin',
      icon: 'recycle',
      open: () => {
        playClick();
        setRecycleOpen(true);
      },
    },
  ];

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, s: Shortcut) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      s.open();
    }
  };

  return (
    <>
    <div className="desktop-icons" role="group" aria-label="Desktop shortcuts">
      {shortcuts.map((s) => (
        <button
          key={s.id}
          type="button"
          className="desktop-icon"
          data-selected={selected === s.id ? 'true' : 'false'}
          title="Double-click or press Enter to open"
          onClick={() => setSelected(s.id)}
          onDoubleClick={s.open}
          onKeyDown={(e) => onKeyDown(e, s)}
          onBlur={() => setSelected((cur) => (cur === s.id ? null : cur))}
        >
          <PixelIcon name={s.icon} size={32} />
          <span className="desktop-icon__label">{s.label}</span>
        </button>
      ))}
    </div>
    {recycleOpen ? (
      <MessageDialog title="Recycle Bin" message={RECYCLE_BIN_MESSAGE} onClose={() => setRecycleOpen(false)} />
    ) : null}
    </>
  );
}
