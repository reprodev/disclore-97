import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { playClick, playSpinUp } from '../audio/audio';
import type { DiscManifest } from '../model/manifest';
import { PixelIcon } from './PixelIcon';
import type { IconName } from './PixelIcon';
import '../styles/shortcuts.css';

/** Disc shortcuts. A shortcut is shown only when its disc is loaded. */
const DISC_SHORTCUTS: { discId: string; label: string; icon: IconName }[] = [
  { discId: 'castles', label: "Castles '97", icon: 'castle' },
  { discId: 'retro-dialup', label: "Retro '97", icon: 'computer' },
];

export interface DesktopIconsProps {
  discs: DiscManifest[];
  onOpenDisc: (discId: string) => void;
  onOpenReadMe: () => void;
}

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
export function DesktopIcons({ discs, onOpenDisc, onOpenReadMe }: DesktopIconsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const shortcuts: Shortcut[] = [
    ...DISC_SHORTCUTS.filter((s) => discs.some((d) => d.disc_id === s.discId)).map((s) => ({
      id: s.discId,
      label: s.label,
      icon: s.icon,
      open: () => {
        playSpinUp();
        onOpenDisc(s.discId);
      },
    })),
    {
      id: 'readme',
      label: 'ReadMe.txt',
      icon: 'notepad',
      open: () => {
        playClick();
        onOpenReadMe();
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
  );
}
