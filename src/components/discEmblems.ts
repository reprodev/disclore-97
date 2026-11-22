import type { IconName } from './PixelIcon';

/** The emblem each built-in disc wears on its Home card. Any other disc gets the CD-ROM. */
export const DISC_EMBLEMS: Readonly<Record<string, IconName>> = {
  castles: 'castle',
  'retro-dialup': 'computer',
  halloween: 'lantern',
  resurrection: 'floppy',
};

export const emblemFor = (discId: string): IconName => DISC_EMBLEMS[discId] ?? 'cd';
