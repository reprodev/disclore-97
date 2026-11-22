import type { DiscManifest, Shape } from '../model/manifest';
import { validateManifest } from '../model/validate';

export const halloweenDisc: DiscManifest = {
  disc_id: 'halloween',
  title: "DiscLore '97: Folklore, Samhain & Halloween",
  tagline: 'Harvest fires, carved lanterns, gargoyles and ghost stories: how the dark night got its traditions.',
  sections: [
    {
      section_id: 'samhain',
      plate: 'mound',
      facts: [
        'Samhain is an old Gaelic festival marking the end of the harvest.',
        'It falls about halfway between the autumn equinox and the winter solstice.',
        'Bonfires and feasts were part of the celebrations.',
        'Many people believed the boundary between worlds grew thin on that night.',
      ],
      timeline: [
        { when: 'Early Middle Ages', event: 'Irish stories describe Samhain as a time of feasts and gatherings.' },
        { when: 'About 800s', event: 'The Christian feast of All Saints is widely kept on 1 November.' },
        { when: 'Middle Ages', event: 'The evening before it becomes known as All Hallows\' Eve, later shortened to Halloween.' },
      ],
      title: 'Samhain and the Harvest Fires',
      paragraphs: [
        'Long before Halloween had its name, people in Ireland, Scotland and the Isle of Man marked Samhain at the turn from autumn to winter. The harvest was in, the cattle came down from summer pasture, and the dark half of the year began.',
        'Bonfires were a central part of the festival. Neighbors gathered around them to share food, and some families carried embers home to relight their hearths. Many believed that on this night the line between the living and the dead grew thin.',
        'The Christian calendar placed All Saints\' Day on 1 November. The evening before was called All Hallows\' Eve, and over the centuries that name wore down into the word Halloween.',
      ],
    },
    {
      section_id: 'jack-o-lanterns',
      plate: 'book',
      facts: [
        'Lanterns were carved from turnips, beets and potatoes long before pumpkins.',
        'The name comes from "Jack of the lantern", a folk figure.',
        'A folk tale tells of a stingy man named Jack who tricked the devil.',
        'Pumpkins are larger and softer, so they are easier to carve.',
      ],
      timeline: [
        { when: '1600s', event: 'The words "jack-o\'-lantern" are used for a night watchman and for the flickering marsh light.' },
        { when: '1800s', event: 'Carved turnip lanterns are part of autumn customs in Ireland and Scotland.' },
        { when: 'Late 1800s and 1900s', event: 'Pumpkins become the favored lantern in North America.' },
      ],
      title: 'Turnips to Jack-o\'-Lanterns',
      paragraphs: [
        'In Ireland and Scotland, families once carved grinning faces into turnips and set a candle inside to ward off spirits. The glowing faces were called jack-o\'-lanterns, a name that earlier meant a night watchman with a lantern, and also the strange lights that drift over marshes.',
        'A folk tale explains the name with a stingy man called Jack, who tricked the devil and was left to wander in the dark with a glowing coal in a hollowed turnip.',
        'Emigrants carried the custom to North America, where pumpkins were plentiful. A pumpkin is bigger and softer than a turnip and far easier to carve, so it soon replaced it.',
      ],
    },
    {
      section_id: 'gothic-gargoyles',
      plate: 'tower',
      facts: [
        'A gargoyle is a carved spout that throws rainwater away from a wall.',
        'The word comes from an old French word for throat.',
        'A carved figure that does not carry water is called a grotesque.',
        'The first Gothic novel was named for a castle, in 1764.',
      ],
      timeline: [
        { when: 'Mid 1100s', event: 'The Gothic style, with pointed arches and tall windows, takes shape in France.' },
        { when: '1764', event: 'Horace Walpole publishes The Castle of Otranto, called the first Gothic novel.' },
        { when: '1800s', event: 'Builders revive the Gothic style for churches, colleges and country houses.' },
      ],
      title: 'Gothic Gargoyles and Keeps',
      paragraphs: [
        'Medieval cathedrals and castles had a practical reason for their stone monsters. A gargoyle is a waterspout, and its open mouth sends rain well away from the wall below so that the mortar stays dry. Carvings that only decorate a building are called grotesques.',
        'Pointed arches, ribbed vaults and tall windows gave Gothic buildings a soaring, shadowy look. Centuries later, writers borrowed that look. In 1764 Horace Walpole set a tale of secrets and omens in a crumbling castle, and a whole style of fiction followed.',
        'Gothic fiction filled its pages with keeps, crypts, secret stairs and storms. Those settings still shape how people picture a haunted house on Halloween.',
      ],
    },
    {
      section_id: 'victorian-ghosts',
      plate: 'gate',
      facts: [
        'A Christmas Carol, with four ghosts, appeared in 1843.',
        'Telling ghost stories on winter nights was a Victorian habit.',
        'Spiritualism, the belief in talking with the dead, spread from 1848.',
        'The Turn of the Screw, a ghost story by Henry James, came out in 1898.',
      ],
      timeline: [
        { when: '1818', event: 'Mary Shelley publishes Frankenstein.' },
        { when: '1843', event: 'Charles Dickens publishes A Christmas Carol.' },
        { when: '1848', event: 'The Fox sisters\' spirit rappings begin the Spiritualist movement.' },
        { when: '1897', event: 'Bram Stoker publishes Dracula.' },
        { when: '1898', event: 'Henry James publishes The Turn of the Screw.' },
      ],
      title: 'Victorian Ghost Stories',
      paragraphs: [
        'Victorian readers adored a good fright. Cheap magazines and cozy winter evenings made ghost stories a favorite pastime, and many were written to be read aloud beside a fire.',
        'Charles Dickens helped set the mood with A Christmas Carol in 1843. Interest in ghosts grew as Spiritualism spread, with circles of friends sitting around a table to ask the dead for signs.',
        'By the end of the century, writers such as Bram Stoker and Henry James had created stories of vampires and haunted nurseries that people still read at Halloween.',
      ],
    },
    {
      section_id: 'modern-halloween',
      plate: 'phone',
      facts: [
        'Medieval "souling" meant begging for small cakes in return for prayers.',
        'In Scotland and Ireland, children went "guising" in costume.',
        'Trick-or-treating became common in North America in the 1930s.',
        'Costumes and packaged candy grew into a large business after the 1950s.',
      ],
      timeline: [
        { when: 'Middle Ages', event: 'Poor people go souling for cakes around All Souls\' Day.' },
        { when: '1800s', event: 'Guising in costume is a custom in Scotland and Ireland.' },
        { when: '1920s and 1930s', event: 'North American newspapers describe children asking for treats on Halloween night.' },
        { when: '1950s', event: 'Store-bought costumes and wrapped candy become common.' },
      ],
      title: 'Modern Halloween',
      paragraphs: [
        'Today\'s Halloween is a blend of many older customs. In the Middle Ages, poor people went souling, asking for small cakes in return for prayers for the dead. Later, children in Scotland and Ireland went guising, dressing up and performing a song or a joke for a treat.',
        'In North America, those customs turned into trick-or-treating. By the 1930s, children in costume were knocking on doors, and towns hosted parties to keep the night orderly.',
        'After the 1950s, costumes, decorations and wrapped candy became a big seasonal business, and the holiday spread to many countries around the world.',
      ],
    },
  ],
  diagrams: [
    {
      diagram_id: 'haunted-hill',
      title: 'The Haunted Hill on Halloween Night',
      viewBox: '0 0 100 100',
      shapes: [
        // Night sky, a lighter band near the horizon, and stars
        { kind: 'rect', x: 0, y: 0, width: 100, height: 62, fill: 'var(--color-night)', stroke: 'none' },
        { kind: 'rect', x: 0, y: 36, width: 100, height: 26, fill: 'var(--color-night-light)', stroke: 'none' },
        ...[
          [6, 6], [18, 12], [30, 5], [44, 10], [58, 4], [66, 12], [92, 8], [10, 28], [26, 24], [88, 30],
        ].map(([x, y]): Shape => ({ kind: 'rect', x: x!, y: y!, width: 1, height: 1, fill: 'var(--color-paper)', stroke: 'none' })),
        // Moon with craters and a glint
        { kind: 'circle', cx: 80, cy: 16, r: 8, fill: 'var(--color-gold-light)', stroke: 'none' },
        { kind: 'circle', cx: 77, cy: 14, r: 1.6, fill: 'var(--color-gold)', stroke: 'none' },
        { kind: 'circle', cx: 83, cy: 19, r: 1.2, fill: 'var(--color-gold)', stroke: 'none' },
        { kind: 'polygon', points: [[74, 11], [78, 8.5], [79.5, 10.5], [75.5, 13]], fill: 'var(--color-paper)', stroke: 'none', anim: 'glint' },
        // Bats
        { kind: 'polygon', points: [[16, 20], [20, 18], [22, 20], [24, 18], [28, 20], [22, 23]], fill: 'var(--color-ink)', stroke: 'none' },
        { kind: 'polygon', points: [[44, 14], [47, 12.5], [48.5, 14], [50, 12.5], [53, 14], [48.5, 16.5]], fill: 'var(--color-ink)', stroke: 'none' },
        // Hills and ground
        { kind: 'polygon', points: [[0, 62], [0, 54], [18, 58], [38, 52], [62, 58], [82, 52], [100, 57], [100, 62]], fill: 'var(--color-forest-dark)', stroke: 'none' },
        { kind: 'rect', x: 0, y: 62, width: 100, height: 38, fill: 'var(--color-forest-dark)', stroke: 'none' },
        { kind: 'polygon', points: [[28, 66], [38, 56], [74, 56], [86, 66]], fill: 'var(--color-forest)', stroke: 'none' },
        { kind: 'rect', x: 0, y: 84, width: 100, height: 16, fill: 'var(--color-wood-dark)', stroke: 'none' },
        { kind: 'rect', x: 0, y: 84, width: 100, height: 2, fill: 'var(--color-wood)', stroke: 'none' },
        // Castle: wall, towers, merlons
        { kind: 'rect', x: 40, y: 44, width: 32, height: 22, fill: 'var(--color-stone-dark)', stroke: 'none' },
        { kind: 'rect', x: 52, y: 30, width: 12, height: 36, fill: 'var(--color-stone-dark)', stroke: 'none' },
        { kind: 'rect', x: 40, y: 38, width: 8, height: 28, fill: 'var(--color-stone-dark)', stroke: 'none' },
        { kind: 'rect', x: 66, y: 40, width: 8, height: 26, fill: 'var(--color-stone-dark)', stroke: 'none' },
        { kind: 'rect', x: 52, y: 30, width: 2, height: 36, fill: 'var(--color-stone)', stroke: 'none' },
        ...[40, 44, 66, 70].map((x): Shape => ({ kind: 'rect', x, y: 36, width: 3, height: 2, fill: 'var(--color-stone-dark)', stroke: 'none' })),
        { kind: 'polygon', points: [[50, 30], [58, 17], [66, 30]], fill: 'var(--color-crimson-dark)', stroke: 'none' },
        { kind: 'polygon', points: [[39, 38], [44, 29], [49, 38]], fill: 'var(--color-crimson-dark)', stroke: 'none' },
        { kind: 'polygon', points: [[65, 40], [70, 31], [75, 40]], fill: 'var(--color-crimson-dark)', stroke: 'none' },
        { kind: 'line', x1: 58, y1: 17, x2: 58, y2: 11, stroke: 'var(--color-ink)' },
        { kind: 'polygon', points: [[58, 11], [63, 12.5], [58, 14]], fill: 'var(--color-crimson)', stroke: 'none' },
        // Lit windows that flicker, and the door
        { kind: 'rect', x: 56, y: 38, width: 4, height: 7, fill: 'var(--color-flame-hot)', stroke: 'none', anim: 'flicker' },
        { kind: 'rect', x: 43, y: 46, width: 3, height: 5, fill: 'var(--color-gold)', stroke: 'none', anim: 'flicker' },
        { kind: 'rect', x: 69, y: 48, width: 3, height: 5, fill: 'var(--color-gold)', stroke: 'none', anim: 'flicker' },
        { kind: 'rect', x: 54, y: 56, width: 8, height: 10, fill: 'var(--color-ink)', stroke: 'none' },
        { kind: 'polygon', points: [[54, 56], [58, 52], [62, 56]], fill: 'var(--color-ink)', stroke: 'none' },
        // Gargoyle perched on the left tower
        { kind: 'polygon', points: [[35, 40], [39, 37], [41, 38], [41, 42], [37, 43]], fill: 'var(--color-stone-light)', stroke: 'none' },
        { kind: 'rect', x: 36, y: 38, width: 1, height: 1, fill: 'var(--color-crimson)', stroke: 'none' },
        // Bonfire
        { kind: 'rect', x: 6, y: 76, width: 14, height: 3, fill: 'var(--color-wood-dark)', stroke: 'none' },
        { kind: 'line', x1: 7, y1: 78, x2: 19, y2: 73, stroke: 'var(--color-wood)' },
        { kind: 'line', x1: 7, y1: 73, x2: 19, y2: 78, stroke: 'var(--color-wood)' },
        { kind: 'polygon', points: [[8, 75], [10, 66], [13, 70], [14, 60], [17, 69], [19, 66], [20, 75]], fill: 'var(--color-flame)', stroke: 'none', anim: 'flicker' },
        { kind: 'polygon', points: [[11, 75], [13, 69], [14, 66], [16, 75]], fill: 'var(--color-flame-hot)', stroke: 'none', anim: 'flicker' },
        // Jack-o'-lantern
        { kind: 'rect', x: 80.5, y: 69, width: 3, height: 3, fill: 'var(--color-forest)', stroke: 'none' },
        { kind: 'circle', cx: 82, cy: 78, r: 8, fill: 'var(--color-flame)', stroke: 'var(--color-wood-dark)' },
        { kind: 'polygon', points: [[77, 76], [80, 76], [78.5, 73]], fill: 'var(--color-flame-hot)', stroke: 'none', anim: 'flicker' },
        { kind: 'polygon', points: [[84, 76], [87, 76], [85.5, 73]], fill: 'var(--color-flame-hot)', stroke: 'none', anim: 'flicker' },
        { kind: 'polygon', points: [[77, 80], [79, 83], [81, 81], [83, 83], [85, 81], [87, 80], [86, 84], [78, 84]], fill: 'var(--color-flame-hot)', stroke: 'none', anim: 'flicker' },
        // Trick-or-treat bucket
        { kind: 'polygon', points: [[62, 80], [72, 80], [70, 90], [64, 90]], fill: 'var(--color-wood-light)', stroke: 'none' },
        { kind: 'rect', x: 62, y: 79, width: 10, height: 2, fill: 'var(--color-wood)', stroke: 'none' },
        { kind: 'circle', cx: 65, cy: 78, r: 1.3, fill: 'var(--color-crimson-light)', stroke: 'none' },
        { kind: 'circle', cx: 68, cy: 77.5, r: 1.3, fill: 'var(--color-gold-light)', stroke: 'none' },
        { kind: 'circle', cx: 70.5, cy: 78.5, r: 1.1, fill: 'var(--color-sky)', stroke: 'none' },
        { kind: 'line', x1: 62, y1: 80, x2: 67, y2: 74, stroke: 'var(--color-wood-dark)' },
        { kind: 'line', x1: 72, y1: 80, x2: 67, y2: 74, stroke: 'var(--color-wood-dark)' },
        // Fence posts
        ...[26, 32, 38, 44].map((x): Shape => ({ kind: 'rect', x, y: 74, width: 2, height: 10, fill: 'var(--color-wood-light)', stroke: 'none' })),
        { kind: 'rect', x: 25, y: 77, width: 22, height: 1.5, fill: 'var(--color-wood-light)', stroke: 'none' },
      ],
      hotspots: [
        { label: 'Harvest bonfire', x: 14, y: 68, section_id: 'samhain' },
        { label: 'Gargoyle', x: 38, y: 36, section_id: 'gothic-gargoyles' },
        { label: 'Haunted window', x: 58, y: 40, section_id: 'victorian-ghosts' },
        { label: 'Candy bucket', x: 67, y: 85, section_id: 'modern-halloween' },
        { label: 'Jack-o\'-lantern', x: 82, y: 78, section_id: 'jack-o-lanterns' },
      ],
    },
  ],
  trivia: [
    {
      question_id: 'q-samhain',
      prompt: 'What did the old Gaelic festival of Samhain mark?',
      options: ['The end of the harvest', 'The first day of spring', 'A midsummer fair', 'The new year at sea'],
      correct_index: 0,
      section_id: 'samhain',
    },
    {
      question_id: 'q-all-hallows',
      prompt: 'Which older name did the word Halloween wear down from?',
      options: ['Saint\'s Fair', 'All Hallows\' Eve', 'Harvest Home', 'Soul Cake Day'],
      correct_index: 1,
      section_id: 'samhain',
    },
    {
      question_id: 'q-lantern-first',
      prompt: 'What were lanterns carved from before pumpkins became the favorite?',
      options: ['Gourd shells', 'Wax blocks', 'Turnips and similar roots', 'Hollow logs'],
      correct_index: 2,
      section_id: 'jack-o-lanterns',
    },
    {
      question_id: 'q-gargoyle',
      prompt: 'What is the practical job of a gargoyle?',
      options: ['Scaring birds', 'Throwing rainwater away from the wall', 'Holding up the roof', 'Marking the doorway'],
      correct_index: 1,
      section_id: 'gothic-gargoyles',
    },
    {
      question_id: 'q-otranto',
      prompt: 'Which 1764 book is called the first Gothic novel?',
      options: ['Dracula', 'Frankenstein', 'The Castle of Otranto', 'The Turn of the Screw'],
      correct_index: 2,
      section_id: 'gothic-gargoyles',
    },
    {
      question_id: 'q-carol',
      prompt: 'Which Dickens story from 1843 features four ghosts?',
      options: ['Great Expectations', 'Oliver Twist', 'A Tale of Two Cities', 'A Christmas Carol'],
      correct_index: 3,
      section_id: 'victorian-ghosts',
    },
    {
      question_id: 'q-souling',
      prompt: 'What did people in the Middle Ages go souling for?',
      options: ['Small cakes in return for prayers', 'Firewood', 'Candles for the church', 'Apples for cider'],
      correct_index: 0,
      section_id: 'modern-halloween',
    },
    {
      question_id: 'q-guising',
      prompt: 'What was guising, in Scotland and Ireland?',
      options: ['Lighting beacon fires', 'Carving lanterns', 'Dressing up and performing for a treat', 'Telling ghost stories at a fair'],
      correct_index: 2,
      section_id: 'modern-halloween',
    },
  ],
  dungeons: [
    {
      dungeon_id: 'halloween-keepmaze',
      title: 'The Hollow Halls of Hallowtide',
      rooms: [
        {
          room_id: 'entrance',
          name: 'Lych Gate',
          description: 'A roofed wooden gate creaks in the wind. Beyond it, a lantern-lit path winds between leaning stones.',
          exits: [{ to: 'graveyard_path' }],
        },
        {
          room_id: 'graveyard_path',
          name: 'Graveyard Path',
          description: 'Fallen leaves crunch underfoot. A glow flickers to the east, and a pumpkin grins from a wall to the west.',
          exits: [{ to: 'entrance' }, { to: 'bonfire_clearing' }, { to: 'pumpkin_patch' }, { to: 'gargoyle_gallery' }],
        },
        {
          room_id: 'bonfire_clearing',
          name: 'Bonfire Clearing',
          description: 'A harvest fire crackles in a ring of stones. Sparks drift upward like slow red stars.',
          exits: [{ to: 'graveyard_path' }, { to: 'pumpkin_patch' }],
        },
        {
          room_id: 'pumpkin_patch',
          name: 'Pumpkin Patch',
          description: 'Rows of carved faces glow among the vines. One of them seems to be watching you walk past.',
          exits: [{ to: 'graveyard_path' }, { to: 'bonfire_clearing' }, { to: 'candlelit_parlour' }],
        },
        {
          room_id: 'gargoyle_gallery',
          name: 'Gargoyle Gallery',
          description: 'Stone beasts crouch along a rain-streaked cloister, their mouths open to the sky. A spiral stair climbs into the dark.',
          exits: [{ to: 'graveyard_path' }, { to: 'belfry' }, { to: 'crypt_stairs' }],
        },
        {
          room_id: 'belfry',
          name: 'Belfry',
          description: 'A great bell hangs silent among the beams. Bats shift on the rafters, and a trapdoor opens onto a library below.',
          exits: [{ to: 'gargoyle_gallery' }, { to: 'spectral_library' }],
        },
        {
          room_id: 'crypt_stairs',
          name: 'Crypt Stairs',
          description: 'Cold air rises from a narrow stair lined with candle stubs. Far below, something sighs.',
          exits: [{ to: 'gargoyle_gallery' }, { to: 'spectral_library' }],
        },
        {
          room_id: 'spectral_library',
          name: 'Spectral Library',
          description: 'Shelves of ghost stories fill the room, and a few pages turn by themselves. A curtain hides a lit doorway.',
          exits: [{ to: 'belfry' }, { to: 'crypt_stairs' }, { to: 'candlelit_parlour' }, { to: 'throne_room' }],
        },
        {
          room_id: 'candlelit_parlour',
          name: 'Candlelit Parlour',
          description: 'Friends sit around a round table with their hands spread flat. The candles lean toward the door.',
          exits: [{ to: 'pumpkin_patch' }, { to: 'spectral_library' }],
        },
        {
          room_id: 'throne_room',
          name: 'The Last Lantern',
          description: 'A single lantern burns on a stone table at the heart of the halls. You have reached the end of the night.',
          exits: [{ to: 'spectral_library' }],
        },
      ],
    },
  ],
};

const check = validateManifest(halloweenDisc);
if (!check.ok) {
  throw new Error(
    'halloween disc is invalid: ' + check.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
  );
}
