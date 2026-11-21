import type { DiscManifest } from '../model/manifest';

export const retroDisc: DiscManifest = {
  disc_id: 'retro-dialup',
  title: "DiscLore '97: Retro Computing & Dial-Up Era",
  tagline: 'Beige boxes, screeching modems, and the sound of the information highway.',
  sections: [
    {
      section_id: 'beige-box',
      title: 'The Beige Box on the Desk',
      paragraphs: [
        'The typical home computer of the mid 1990s was a tower or desktop case molded from beige plastic, paired with a deep cathode ray tube monitor that took up half the desk.',
        'Inside sat a motherboard, a few expansion cards, a hard drive measured in megabytes, and a fan that hummed all day. Upgrading meant opening the case with a screwdriver and pressing cards into slots.',
      ],
    },
    {
      section_id: 'modem-handshake',
      title: 'The Modem Handshake',
      paragraphs: [
        'A dial-up modem turned data into audio tones so it could travel over an ordinary phone line. When it connected, the two modems exchanged a burst of whistles and static to agree on a speed.',
        'That noise was the negotiation. Each side tested the line, then settled on the fastest rate the wire could carry without errors.',
      ],
    },
    {
      section_id: 'phone-line',
      title: 'One Line, One Conversation',
      paragraphs: [
        'Most homes had a single phone line. While the modem was online, the line was busy, so callers heard a busy signal and family members waited their turn.',
        'Speeds of 14.4 and 28.8 kilobits per second were common, and a 56k modem was the dream upgrade. A single large picture could take minutes to arrive.',
      ],
    },
    {
      section_id: 'floppy-and-cd',
      title: 'Floppies and Shiny Discs',
      paragraphs: [
        'Programs travelled on floppy disks holding about one and a half megabytes each. Big software shipped as stacks of them, and you fed them in one at a time while a progress bar crawled.',
        'The CD-ROM changed that. One disc held hundreds of megabytes, enough for encyclopedias, games with video clips, and collections of reference articles you could browse offline.',
      ],
    },
    {
      section_id: 'bulletin-boards',
      title: 'Bulletin Board Systems',
      paragraphs: [
        'Before the web was common, many people dialed directly into a bulletin board, a computer run by a hobbyist in a spare room. Only one or a few callers could connect at a time.',
        'Boards offered message areas, file libraries, and text games. Users picked handles, read posts left by others, and logged off so the next caller could get through.',
      ],
    },
    {
      section_id: 'early-web',
      title: 'The Early Web',
      paragraphs: [
        'Early web pages were plain: gray backgrounds, blue underlined links, tiled textures, and small images saved to load quickly. Browsers showed a spinning logo while they waited.',
        'Page builders added counters, guestbooks, and "under construction" signs. Personal home pages were proud, cluttered, and handmade.',
      ],
    },
    {
      section_id: 'dos-prompt',
      title: 'Life at the Command Prompt',
      paragraphs: [
        'Before windows and icons became the norm, you typed commands at a blinking cursor. Listing files, copying them, and starting programs all happened through short typed words.',
        'Memory limits were tight, so players and tinkerers edited startup files by hand to squeeze a game into the available space.',
      ],
    },
  ],
  diagrams: [
    {
      diagram_id: 'dialup-setup',
      title: 'A Dial-Up Home Setup',
      viewBox: '0 0 100 100',
      shapes: [
        { kind: 'rect', x: 8, y: 10, width: 36, height: 30, fill: 'none', stroke: 'currentColor' },
        { kind: 'rect', x: 13, y: 15, width: 26, height: 20, fill: 'var(--screen, none)', stroke: 'currentColor' },
        { kind: 'rect', x: 16, y: 42, width: 20, height: 6, fill: 'none', stroke: 'currentColor' },
        { kind: 'rect', x: 8, y: 58, width: 36, height: 14, fill: 'none', stroke: 'currentColor' },
        { kind: 'circle', cx: 16, cy: 65, r: 2, fill: 'currentColor', stroke: 'none' },
        { kind: 'circle', cx: 24, cy: 65, r: 2, fill: 'currentColor', stroke: 'none' },
        { kind: 'rect', x: 58, y: 62, width: 24, height: 12, fill: 'none', stroke: 'currentColor' },
        { kind: 'line', x1: 44, y1: 65, x2: 58, y2: 68, stroke: 'currentColor' },
        { kind: 'line', x1: 82, y1: 68, x2: 92, y2: 50, stroke: 'currentColor' },
        { kind: 'line', x1: 92, y1: 50, x2: 92, y2: 20, stroke: 'currentColor' },
        { kind: 'polygon', points: [[92, 8], [98, 20], [86, 20]], fill: 'none', stroke: 'currentColor' },
        { kind: 'line', x1: 26, y1: 48, x2: 26, y2: 58, stroke: 'currentColor' },
      ],
      hotspots: [
        { label: 'Computer and monitor', x: 26, y: 25, section_id: 'beige-box' },
        { label: 'Modem', x: 70, y: 68, section_id: 'modem-handshake' },
        { label: 'Phone wire', x: 92, y: 35, section_id: 'phone-line' },
        { label: 'Drive bay', x: 26, y: 65, section_id: 'floppy-and-cd' },
      ],
    },
  ],
  trivia: [
    {
      question_id: 'q-handshake',
      prompt: 'What was the noise a modem made when connecting?',
      options: ['A speed negotiation between two modems', 'A warning about a virus', 'The hard drive spinning up', 'A busy signal'],
      correct_index: 0,
      section_id: 'modem-handshake',
    },
    {
      question_id: 'q-busy',
      prompt: 'Why could callers not reach a home while someone was online with a dial-up modem?',
      options: ['The computer blocked calls', 'The single phone line was in use', 'Modems disabled the doorbell', 'Phone companies limited calls'],
      correct_index: 1,
      section_id: 'phone-line',
    },
    {
      question_id: 'q-cd',
      prompt: 'What advantage did a CD-ROM have over a floppy disk?',
      options: ['It was smaller', 'It held far more data', 'It could be rewritten easily by any user', 'It needed no drive'],
      correct_index: 1,
      section_id: 'floppy-and-cd',
    },
    {
      question_id: 'q-bbs',
      prompt: 'Who typically ran a bulletin board system?',
      options: ['A government agency', 'A cable company', 'A hobbyist with a spare computer', 'A search engine'],
      correct_index: 2,
      section_id: 'bulletin-boards',
    },
    {
      question_id: 'q-web',
      prompt: 'Which feature was common on early personal web pages?',
      options: ['Video streaming', 'Under construction signs', 'Voice assistants', 'Touch screens'],
      correct_index: 1,
      section_id: 'early-web',
    },
    {
      question_id: 'q-prompt',
      prompt: 'How did people start programs at a command prompt?',
      options: ['By clicking icons', 'By typing short commands', 'By speaking aloud', 'By inserting a key'],
      correct_index: 1,
      section_id: 'dos-prompt',
    },
  ],
  dungeons: [
    {
      dungeon_id: 'retro-keep',
      title: 'The Cursor Catacombs',
      rooms: [
        {
          room_id: 'entrance',
          name: 'Power-On Foyer',
          description: 'A fan whirs and a green light blinks. A white-on-black memory count ticks upward on a monitor as you step inside.',
          exits: [{ to: 'boot_hall' }, { to: 'floppy_closet' }],
        },
        {
          room_id: 'boot_hall',
          name: 'Boot Hall',
          description: 'Rows of startup lines scroll along the walls. A blinking cursor waits at the far end, patient as a doorman.',
          exits: [{ to: 'entrance' }, { to: 'modem_chamber' }, { to: 'prompt_vault' }],
        },
        {
          room_id: 'floppy_closet',
          name: 'Floppy Closet',
          description: 'Shelves sag under stacks of labeled disks. A hand-written label reads "Disk 7 of 23", and Disk 7 is missing.',
          exits: [{ to: 'entrance' }, { to: 'boot_hall' }],
        },
        {
          room_id: 'modem_chamber',
          name: 'Modem Chamber',
          description: 'Whistles, hisses, and static echo off the walls as two unseen machines haggle over a speed. A tangled phone cord snakes across the floor.',
          exits: [{ to: 'bbs_lounge' }, { to: 'boot_hall' }],
        },
        {
          room_id: 'prompt_vault',
          name: 'Prompt Vault',
          description: 'A dim room lit only by a flashing underscore. Typed words hang in the air, and a directory listing scrolls past in amber letters.',
          exits: [{ to: 'boot_hall' }, { to: 'memory_maze' }],
        },
        {
          room_id: 'bbs_lounge',
          name: 'Bulletin Board Lounge',
          description: 'Handles glow on a corkboard of messages. A sign says only one caller may enter at a time, so you wait your turn.',
          exits: [{ to: 'modem_chamber' }, { to: 'web_gallery' }],
        },
        {
          room_id: 'memory_maze',
          name: 'Memory Maze',
          description: 'Narrow corridors are labeled with tiny numbers. Each wall is a limit, and a startup file hangs on a hook, begging to be edited.',
          exits: [{ to: 'prompt_vault' }, { to: 'cd_library' }],
        },
        {
          room_id: 'web_gallery',
          name: 'Gallery of Home Pages',
          description: 'Tiled-texture wallpaper, a hit counter that never moves, and a banner reading "Under Construction" mark the pages along this hall.',
          exits: [{ to: 'bbs_lounge' }, { to: 'cd_library' }],
        },
        {
          room_id: 'cd_library',
          name: 'CD-ROM Library',
          description: 'Shiny discs fan out on a rotating rack, each one rainbowed in the light. A drive tray slides open, inviting you forward.',
          exits: [{ to: 'memory_maze' }, { to: 'web_gallery' }, { to: 'throne_room' }],
        },
        {
          room_id: 'throne_room',
          name: 'The Tower Throne',
          description: 'A great beige tower sits on a dais, its power light glowing like a crown jewel. A chair of rolled office foam awaits the new ruler of the desktop.',
          exits: [],
        },
      ],
    },
  ],
};
