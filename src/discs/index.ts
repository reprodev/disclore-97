import type { DiscManifest } from '../model/manifest';
import { castlesDisc } from './castles';
import { halloweenDisc } from './halloween';
import { resurrectionDisc } from './resurrection';
import { retroDisc } from './retro';

export { castlesDisc, halloweenDisc, resurrectionDisc, retroDisc };

/** The built-in discs, in the order they appear on the Home shelf: a 2 by 2 grid of four. */
export const prebakedDiscs: readonly DiscManifest[] = [castlesDisc, retroDisc, halloweenDisc, resurrectionDisc];