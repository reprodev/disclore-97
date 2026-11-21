import { parseInput } from '../model/sourceInput';

export type BurnPreset = {
  id: string;
  label: string;
  text: string;
  kind: 'github' | 'topic';
};

export const BURN_PRESETS: readonly BurnPreset[] = [
  {
    id: 'repo-hello-world',
    label: 'GitHub: octocat/Hello-World',
    text: 'https://github.com/octocat/Hello-World',
    kind: 'github',
  },
  {
    id: 'repo-react',
    label: 'GitHub: facebook/react',
    text: 'https://github.com/facebook/react',
    kind: 'github',
  },
  {
    id: 'topic-lighthouses',
    label: 'Topic: Lighthouses',
    text: 'Lighthouses and the keepers who tended their lamps',
    kind: 'topic',
  },
  {
    id: 'topic-tide-pools',
    label: 'Topic: Tide pools',
    text: 'Life in tide pools along a rocky shore',
    kind: 'topic',
  },
];

/** True when every preset parses to its declared kind. */
export function presetsAreValid(): boolean {
  return BURN_PRESETS.every((p) => {
    const r = parseInput(p.text);
    return r.ok && r.kind === p.kind;
  });
}
