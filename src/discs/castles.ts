import type { DiscManifest } from '../model/manifest';
import { validateManifest } from '../model/validate';

export const castlesDisc: DiscManifest = {
  disc_id: 'castles',
  title: "DiscLore '97: Ancient Castles & Keeps",
  tagline: 'Walls, wards and winding stairs: a tour of the fortified home.',
  sections: [
    {
      section_id: 'motte-and-bailey',
      title: 'Motte and Bailey',
      paragraphs: [
        'The earliest castles in many regions were built from earth and timber. A motte is a steep mound of packed soil, and a wooden tower on top served as the last refuge.',
        'Beside the mound lay the bailey, an enclosed yard holding stables, a smithy and sleeping huts. A ditch and a palisade fence ringed both parts.',
        'Crews could raise such a fortress in a few weeks, which made it ideal for holding newly claimed land.',
      ],
    },
    {
      section_id: 'the-keep',
      title: 'The Keep',
      paragraphs: [
        'The keep is the central tower of a castle. Stone keeps replaced timber towers because stone resists fire and battering.',
        'Walls could be several paces thick. The ground floor was usually a storeroom with no outside door, and the main entrance sat on an upper level reached by a removable stair.',
        'Inside, the great hall held feasts and councils, while the lord slept in a private chamber above.',
      ],
    },
    {
      section_id: 'curtain-walls',
      title: 'Curtain Walls and Towers',
      paragraphs: [
        'A curtain wall is the long defensive wall that encloses the courtyard. Towers set along it let archers shoot along the face of the wall at attackers who reached its base.',
        'Round towers deflected missiles and were harder to undermine than square corners, so later builders favored them.',
        'The wall top carried a walkway with a parapet. Gaps in the parapet, called crenels, alternated with solid blocks called merlons.',
      ],
    },
    {
      section_id: 'gatehouse-and-moat',
      title: 'Gatehouse and Moat',
      paragraphs: [
        'The gatehouse was the strongest point of the outer wall, since every visitor had to pass through it. It often held a drawbridge, a portcullis and heavy double doors.',
        'A portcullis is a grid of timber or iron that slides down in grooves to seal the passage. Holes in the ceiling above, called murder holes, let defenders drop stones or water on trapped intruders.',
        'A moat, wet or dry, kept enemies from reaching the wall with ladders or tunnels.',
      ],
    },
    {
      section_id: 'siege-and-defense',
      title: 'Siege and Defense',
      paragraphs: [
        'Attackers rarely stormed a strong castle directly. They surrounded it and waited for supplies to run short, a siege that could last months.',
        'Siege engines such as the trebuchet hurled heavy stones using a swinging counterweight. Miners dug under walls and propped the tunnel with timber, then burned the props so the wall above collapsed.',
        'Defenders answered with deep wells, stocked granaries and sorties to burn the engines.',
      ],
    },
  ],
  diagrams: [
    {
      diagram_id: 'castle-plan',
      title: 'Castle Cross-Section',
      viewBox: '0 0 100 100',
      shapes: [
        { kind: 'rect', x: 0, y: 85, width: 100, height: 15, fill: 'none', stroke: 'currentColor' },
        { kind: 'rect', x: 5, y: 50, width: 15, height: 35, fill: 'none', stroke: 'currentColor' },
        { kind: 'rect', x: 80, y: 50, width: 15, height: 35, fill: 'none', stroke: 'currentColor' },
        { kind: 'rect', x: 35, y: 20, width: 30, height: 65, fill: 'none', stroke: 'currentColor' },
        { kind: 'polygon', points: [[35, 20], [50, 5], [65, 20]], fill: 'none', stroke: 'currentColor' },
        { kind: 'line', x1: 20, y1: 65, x2: 35, y2: 65, stroke: 'currentColor' },
        { kind: 'line', x1: 65, y1: 65, x2: 80, y2: 65, stroke: 'currentColor' },
        { kind: 'rect', x: 43, y: 65, width: 14, height: 20, fill: 'none', stroke: 'var(--accent, currentColor)' },
        { kind: 'circle', cx: 50, cy: 35, r: 4, fill: 'none', stroke: 'currentColor' },
      ],
      hotspots: [
        { label: 'Keep', x: 50, y: 40, section_id: 'the-keep' },
        { label: 'Curtain wall tower', x: 12, y: 60, section_id: 'curtain-walls' },
        { label: 'Gatehouse', x: 50, y: 78, section_id: 'gatehouse-and-moat' },
        { label: 'Courtyard', x: 28, y: 75, section_id: 'motte-and-bailey' },
      ],
    },
  ],
  trivia: [
    {
      question_id: 'q-motte',
      prompt: 'What is a motte?',
      options: ['A steep earth mound', 'A water-filled ditch', 'A grid of iron bars', 'A feast hall'],
      correct_index: 0,
      section_id: 'motte-and-bailey',
    },
    {
      question_id: 'q-keep-door',
      prompt: 'Where was a stone keep\'s main entrance usually placed?',
      options: ['At ground level', 'On an upper level', 'Underground', 'On the roof'],
      correct_index: 1,
      section_id: 'the-keep',
    },
    {
      question_id: 'q-crenel',
      prompt: 'What are the gaps in a parapet called?',
      options: ['Merlons', 'Bailies', 'Crenels', 'Props'],
      correct_index: 2,
      section_id: 'curtain-walls',
    },
    {
      question_id: 'q-portcullis',
      prompt: 'What does a portcullis do?',
      options: ['Hurls stones', 'Seals the gate passage', 'Stores grain', 'Draws well water'],
      correct_index: 1,
      section_id: 'gatehouse-and-moat',
    },
    {
      question_id: 'q-siege',
      prompt: 'What was the usual goal of a siege?',
      options: ['Run the defenders out of supplies', 'Storm the front gate at once', 'Fill the moat with sand', 'Build a second castle'],
      correct_index: 0,
      section_id: 'siege-and-defense',
    },
    {
      question_id: 'q-round-towers',
      prompt: 'Why did later builders favor round towers?',
      options: ['They were cheaper to paint', 'They deflected missiles and resisted undermining', 'They held more cattle', 'They needed no stone'],
      correct_index: 1,
      section_id: 'curtain-walls',
    },
  ],
  dungeons: [
    {
      dungeon_id: 'castle-keepmaze',
      title: 'The Keep of Many Stairs',
      rooms: [
        {
          room_id: 'entrance',
          name: 'Drawbridge Gate',
          description: 'Chains creak as the drawbridge settles behind you. Ahead, an iron portcullis hangs half raised.',
          exits: [{ to: 'gatehouse' }],
        },
        {
          room_id: 'gatehouse',
          name: 'Gatehouse Passage',
          description: 'Murder holes gape in the ceiling of this narrow, damp passage. Torchlight flickers on stone.',
          exits: [{ to: 'entrance' }, { to: 'courtyard' }],
        },
        {
          room_id: 'courtyard',
          name: 'Bailey Courtyard',
          description: 'A muddy yard with a smithy, a well and wandering hens. Stairs climb to the wall walk, and a heavy door leads to the great hall.',
          exits: [{ to: 'gatehouse' }, { to: 'wall_walk' }, { to: 'great_hall' }, { to: 'armory' }],
        },
        {
          room_id: 'armory',
          name: 'Armory',
          description: 'Racks of dull spears and rusted helms line the walls. A low archway leads down to the cellar.',
          exits: [{ to: 'courtyard' }, { to: 'cellar' }],
        },
        {
          room_id: 'cellar',
          name: 'Storage Cellar',
          description: 'Barrels of salt fish and sacks of grain are stacked to the vaulted ceiling. A narrow stair rises into the keep.',
          exits: [{ to: 'armory' }, { to: 'great_hall' }],
        },
        {
          room_id: 'wall_walk',
          name: 'Wall Walk',
          description: 'Wind whips along the battlements between crenels and merlons. A tower door waits at the far end.',
          exits: [{ to: 'courtyard' }, { to: 'watchtower' }],
        },
        {
          room_id: 'watchtower',
          name: 'Round Watchtower',
          description: 'A cramped round room with arrow slits on every side. A spiral stair winds up and inward to the lord\'s level.',
          exits: [{ to: 'wall_walk' }, { to: 'solar' }],
        },
        {
          room_id: 'great_hall',
          name: 'Great Hall',
          description: 'Long tables sit beneath smoky rafters, and banners hang from the walls. A staircase climbs behind the dais.',
          exits: [{ to: 'courtyard' }, { to: 'cellar' }, { to: 'solar' }],
        },
        {
          room_id: 'solar',
          name: 'Solar Chamber',
          description: 'A quiet private room with a tapestry and a sunlit window seat. A carved door stands closed at the end.',
          exits: [{ to: 'great_hall' }, { to: 'watchtower' }, { to: 'throne_room' }],
        },
        {
          room_id: 'throne_room',
          name: 'Throne Room',
          description: 'A high stone seat rests on a dais under a vaulted ceiling. You have reached the heart of the keep.',
          exits: [{ to: 'solar' }],
        },
      ],
    },
  ],
};

const check = validateManifest(castlesDisc);
if (!check.ok) {
  throw new Error(
    'castles disc is invalid: ' + check.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
  );
}
