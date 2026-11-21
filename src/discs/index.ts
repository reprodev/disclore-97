import type { DiscManifest } from '../model/manifest';
import { castlesDisc } from './castles';
import { retroDisc } from './retro';

export { castlesDisc, retroDisc };

export const prebakedDiscs: readonly DiscManifest[] = [castlesDisc, retroDisc];
