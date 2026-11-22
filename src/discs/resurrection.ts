import type { DiscManifest } from '../model/manifest';
import { validateManifest } from '../model/validate';

export const resurrectionDisc: DiscManifest = {
  disc_id: 'resurrection',
  title: "DiscLore '97: Lost Formats & Digital Resurrection",
  tagline: 'Silver discs, floppy disks and glowing tubes: how old software is saved and brought back to life.',
  sections: [
    {
      section_id: 'silver-cd-rom',
      plate: 'disc',
      facts: [
        'CD-ROM stands for Compact Disc Read-Only Memory.',
        'A standard disc holds about 650 to 700 megabytes.',
        'A "1x" drive reads about 150 kilobytes every second.',
        'Multimedia encyclopedias helped make CD-ROM drives common in homes.',
      ],
      timeline: [
        { when: '1982', event: 'The audio compact disc goes on sale.' },
        { when: 'Mid 1980s', event: 'CD-ROM drives and the first CD-ROM reference works reach computers.' },
        { when: 'Early 1990s', event: 'Multimedia PCs make a CD-ROM drive a standard feature.' },
        { when: 'Late 1990s', event: 'DVD-ROM and faster internet links begin to replace CD-ROM publishing.' },
      ],
      title: 'The Silver CD-ROM',
      paragraphs: [
        'A CD-ROM stores data as a long spiral of tiny pits pressed into a plastic disc and covered with a shiny metal layer. A laser in the drive reads the pits as ones and zeros. The disc is read-only, so the publisher presses it once and nobody can change it.',
        'One disc held about 650 megabytes, hundreds of times more than a floppy disk. That was enough room for a whole encyclopedia with pictures, sound and short videos, and it made the format a natural home for multimedia.',
        'Early drives were slow. A "1x" drive moved about 150 kilobytes each second, and faster drives were sold as 2x, 4x and more, which is why the speed of a drive was printed on the front.',
      ],
    },
    {
      section_id: 'hypercard',
      plate: 'computer',
      facts: [
        'HyperCard arrived in 1987 for the Apple Macintosh.',
        'A project was a "stack" made of cards, with buttons that linked them.',
        'Its scripting language was called HyperTalk and read like English.',
        'The first version of the game Myst was built as a HyperCard stack.',
      ],
      timeline: [
        { when: '1987', event: 'Apple releases HyperCard for the Macintosh.' },
        { when: 'Late 1980s', event: 'Teachers, hobbyists and publishers build stacks of their own.' },
        { when: '1993', event: 'The game Myst is released, after starting life as a HyperCard stack.' },
        { when: '2004', event: 'Apple stops selling HyperCard.' },
      ],
      title: 'HyperCard and Multimedia',
      paragraphs: [
        'HyperCard let ordinary people build interactive programs without being programmers. A project was a stack of cards, much like index cards, and each card could hold text, pictures and buttons that jumped to other cards.',
        'Its scripting language, HyperTalk, used plain phrases such as "go to next card". People made quizzes, address books, picture albums and small games, and many early multimedia CD-ROMs followed the same idea of cards linked by buttons.',
        'The link-and-click style of HyperCard also shaped how people thought about hypertext, which later became the pages and links of the web.',
      ],
    },
    {
      section_id: 'floppy-disks',
      plate: 'terminal',
      facts: [
        'A floppy disk is a flexible magnetic disk inside a protective case.',
        'The common 3.5-inch disk held 1.44 megabytes.',
        'Magnets, heat and damp can damage the stored data.',
        'The "save" icon in many programs still looks like a 3.5-inch disk.',
      ],
      timeline: [
        { when: '1971', event: 'The first floppy disks are sold, 8 inches wide.' },
        { when: '1976', event: 'A smaller 5.25-inch disk appears for early personal computers.' },
        { when: '1981', event: 'Sony introduces the 3.5-inch disk in a hard plastic case.' },
        { when: '1998', event: 'The iMac ships without a floppy drive.' },
        { when: 'Around 2010', event: 'Sony announces the end of its floppy disk production.' },
      ],
      title: 'Floppy Disks and Magnetic Media',
      paragraphs: [
        'A floppy disk records data as tiny magnetized patches on a thin plastic disc coated with iron oxide. A head in the drive touches the spinning disc to read and write the patches.',
        'The first disks were 8 inches wide and floppy indeed. The 3.5-inch disk, with its stiff case and sliding metal shutter, was tougher and held 1.44 megabytes. For years it was how programs, school papers and games moved from one computer to another.',
        'Magnetic media fades over time and can be wiped by a strong magnet. Many old disks are now unreadable, which is one reason people copy them while they still can.',
      ],
    },
    {
      section_id: 'crt-phosphor',
      plate: 'bbs',
      facts: [
        'A CRT shoots a beam of electrons at a phosphor-coated screen.',
        'The beam sweeps across the screen in lines, many times each second.',
        'VGA, from 1987, made 640 by 480 pixels a common size.',
        'Screens of that era had a 4:3 shape.',
      ],
      timeline: [
        { when: '1987', event: 'IBM introduces VGA, which makes 640 by 480 a common screen size.' },
        { when: 'Early 1990s', event: 'Super VGA adds 800 by 600 and more colors.' },
        { when: 'Late 1990s', event: '1024 by 768 becomes popular on bigger monitors.' },
        { when: '2000s', event: 'Flat LCD screens take over from the glass tube.' },
      ],
      title: 'CRT Phosphor and 640 by 480',
      paragraphs: [
        'A cathode ray tube makes a picture with a beam of electrons. The beam sweeps across the back of the screen line by line, and the phosphor coating glows where it hits. Because the glow fades quickly, the beam redraws the whole picture many times each second.',
        'The VGA standard, from 1987, made 640 by 480 pixels the usual size for a computer screen. A multimedia program from the 1990s was often designed to fit that grid exactly, with its pictures drawn pixel by pixel in a limited set of colors.',
        'Today those pictures are shown on much sharper screens, so old software can look blocky, and some people add soft glowing lines to copy the look of a real tube.',
      ],
    },
    {
      section_id: 'preserving-software',
      plate: 'book',
      facts: [
        'A disk image is an exact copy of a disk, stored as one file.',
        'An emulator is a program that pretends to be an older computer.',
        'Old discs and disks wear out, and their drives become hard to find.',
        'Notes about how software ran are as useful as the software itself.',
      ],
      timeline: [
        { when: '1980s and 1990s', event: 'Software is sold on disks and discs that slowly wear out.' },
        { when: '1997', event: 'MAME, an arcade machine emulator, is first released.' },
        { when: '2000s', event: 'Disk images and emulators let old software run on new computers.' },
      ],
      title: 'Preserving Software History',
      paragraphs: [
        'Old software is fragile. Discs scratch, magnetic disks fade, and the machines that ran the programs break down and are no longer made. If nobody copies the software while it can still be read, it is lost.',
        'Preservation starts with a disk image, an exact copy of everything on the disc or disk saved as one file. The image can be stored safely and checked for damage, and it never needs the original to be touched again.',
        'An emulator is a program that behaves like the old machine, so the image can run on a modern computer. Together with notes about how the software was used, images and emulators keep programs alive long after the hardware is gone.',
      ],
    },
  ],
  diagrams: [
    {
      diagram_id: 'archive-bench',
      title: 'The Digital Archive Workbench',
      viewBox: '0 0 100 100',
      shapes: [
        // Wall, baseboard and a window slit
        { kind: 'rect', x: 0, y: 0, width: 100, height: 76, fill: 'var(--color-parchment)', stroke: 'none' },
        { kind: 'rect', x: 0, y: 70, width: 100, height: 6, fill: 'var(--color-parchment-dark)', stroke: 'none' },
        // Wall shelf with boxed software
        { kind: 'rect', x: 58, y: 24, width: 38, height: 3, fill: 'var(--color-wood)', stroke: 'none' },
        { kind: 'rect', x: 58, y: 27, width: 38, height: 1, fill: 'var(--color-wood-dark)', stroke: 'none' },
        { kind: 'rect', x: 60, y: 10, width: 9, height: 14, fill: 'var(--color-title-bg)', stroke: 'none' },
        { kind: 'rect', x: 60, y: 10, width: 9, height: 3, fill: 'var(--color-gold)', stroke: 'none' },
        { kind: 'rect', x: 70, y: 12, width: 8, height: 12, fill: 'var(--color-crimson)', stroke: 'none' },
        { kind: 'rect', x: 70, y: 12, width: 8, height: 3, fill: 'var(--color-gold-light)', stroke: 'none' },
        { kind: 'rect', x: 79, y: 9, width: 9, height: 15, fill: 'var(--color-forest)', stroke: 'none' },
        { kind: 'rect', x: 79, y: 9, width: 9, height: 3, fill: 'var(--color-gold)', stroke: 'none' },
        { kind: 'rect', x: 89, y: 14, width: 6, height: 10, fill: 'var(--color-sky-deep)', stroke: 'none' },
        // CRT monitor, with a blinking cursor
        { kind: 'rect', x: 6, y: 14, width: 38, height: 34, fill: 'var(--color-parchment-dark)', stroke: 'var(--color-wood-dark)' },
        { kind: 'rect', x: 6, y: 44, width: 38, height: 4, fill: 'var(--color-stone-light)', stroke: 'none' },
        { kind: 'rect', x: 10, y: 18, width: 30, height: 24, fill: 'var(--color-crt-bg)', stroke: 'none' },
        { kind: 'rect', x: 12, y: 21, width: 14, height: 1.2, fill: 'var(--color-phosphor)', stroke: 'none' },
        { kind: 'rect', x: 12, y: 25, width: 20, height: 1.2, fill: 'var(--color-phosphor)', stroke: 'none' },
        { kind: 'rect', x: 12, y: 29, width: 10, height: 1.2, fill: 'var(--color-phosphor-dim)', stroke: 'none' },
        { kind: 'rect', x: 12, y: 33, width: 16, height: 1.2, fill: 'var(--color-phosphor)', stroke: 'none' },
        { kind: 'rect', x: 30, y: 33, width: 3, height: 3, fill: 'var(--color-phosphor)', stroke: 'none', anim: 'blink' },
        { kind: 'circle', cx: 38, cy: 45.5, r: 0.9, fill: 'var(--color-phosphor)', stroke: 'none' },
        { kind: 'rect', x: 18, y: 48, width: 14, height: 5, fill: 'var(--color-parchment-dark)', stroke: 'none' },
        { kind: 'rect', x: 12, y: 53, width: 26, height: 3, fill: 'var(--color-stone)', stroke: 'none' },
        // Silver CD-ROM, standing in its stand
        { kind: 'rect', x: 44, y: 54, width: 16, height: 3, fill: 'var(--color-wood)', stroke: 'none' },
        { kind: 'circle', cx: 52, cy: 38, r: 15, fill: 'var(--color-stone-light)', stroke: 'var(--color-ink)' },
        { kind: 'circle', cx: 52, cy: 38, r: 12, fill: 'var(--color-sky)', stroke: 'none' },
        { kind: 'circle', cx: 52, cy: 38, r: 9, fill: 'var(--color-crimson-light)', stroke: 'none' },
        { kind: 'circle', cx: 52, cy: 38, r: 6.5, fill: 'var(--color-gold)', stroke: 'none' },
        { kind: 'circle', cx: 52, cy: 38, r: 4.5, fill: 'var(--color-stone-light)', stroke: 'none' },
        { kind: 'circle', cx: 52, cy: 38, r: 1.8, fill: 'var(--color-parchment)', stroke: 'var(--color-ink)' },
        { kind: 'polygon', points: [[43, 32], [49, 27], [51, 29], [45, 35]], fill: 'var(--color-paper)', stroke: 'none', anim: 'glint' },
        // Workbench
        { kind: 'rect', x: 0, y: 76, width: 100, height: 24, fill: 'var(--color-wood-light)', stroke: 'none' },
        { kind: 'rect', x: 0, y: 76, width: 100, height: 3, fill: 'var(--color-gold-light)', stroke: 'none' },
        { kind: 'rect', x: 0, y: 92, width: 100, height: 8, fill: 'var(--color-wood)', stroke: 'none' },
        // HyperCard stack: three index cards
        { kind: 'rect', x: 8, y: 76, width: 22, height: 13, fill: 'var(--color-parchment-dark)', stroke: 'var(--color-ink)' },
        { kind: 'rect', x: 10, y: 73.5, width: 22, height: 13, fill: 'var(--color-parchment)', stroke: 'var(--color-ink)' },
        { kind: 'rect', x: 12, y: 71, width: 22, height: 13, fill: 'var(--color-paper)', stroke: 'var(--color-ink)' },
        { kind: 'line', x1: 12, y1: 75, x2: 34, y2: 75, stroke: 'var(--color-crimson)' },
        { kind: 'rect', x: 15, y: 77, width: 7, height: 4, fill: 'var(--color-surface)', stroke: 'var(--color-ink)' },
        { kind: 'rect', x: 24, y: 77, width: 7, height: 4, fill: 'var(--color-surface)', stroke: 'var(--color-ink)' },
        // 3.5-inch floppy disk
        { kind: 'rect', x: 68, y: 74, width: 22, height: 22, fill: 'var(--color-title-bg)', stroke: 'var(--color-ink)' },
        { kind: 'rect', x: 73, y: 74, width: 11, height: 8, fill: 'var(--color-stone-light)', stroke: 'var(--color-ink)' },
        { kind: 'rect', x: 79, y: 75.5, width: 3, height: 5, fill: 'var(--color-title-bg)', stroke: 'none' },
        { kind: 'rect', x: 71, y: 85, width: 16, height: 11, fill: 'var(--color-paper)', stroke: 'var(--color-ink)' },
        { kind: 'line', x1: 73, y1: 88, x2: 85, y2: 88, stroke: 'var(--color-crimson)' },
        { kind: 'line', x1: 73, y1: 91, x2: 82, y2: 91, stroke: 'var(--color-bevel-shadow)' },
      ],
      hotspots: [
        { label: 'CRT monitor', x: 25, y: 28, section_id: 'crt-phosphor' },
        { label: 'Silver CD-ROM', x: 52, y: 38, section_id: 'silver-cd-rom' },
        { label: 'Boxed software', x: 78, y: 17, section_id: 'preserving-software' },
        { label: 'HyperCard stack', x: 23, y: 78, section_id: 'hypercard' },
        { label: 'Floppy disk', x: 79, y: 88, section_id: 'floppy-disks' },
      ],
    },
  ],
  trivia: [
    {
      question_id: 'q-cdrom-name',
      prompt: 'What does the "ROM" in CD-ROM stand for?',
      options: ['Random Online Media', 'Read-Only Memory', 'Recorded Optical Music', 'Rapid Output Module'],
      correct_index: 1,
      section_id: 'silver-cd-rom',
    },
    {
      question_id: 'q-cdrom-size',
      prompt: 'About how much data did a standard CD-ROM hold?',
      options: ['1.44 megabytes', '64 kilobytes', '650 to 700 megabytes', '10 gigabytes'],
      correct_index: 2,
      section_id: 'silver-cd-rom',
    },
    {
      question_id: 'q-hypercard-unit',
      prompt: 'What was a HyperCard project called?',
      options: ['A deck of slides', 'A stack of cards', 'A folder of pages', 'A reel of frames'],
      correct_index: 1,
      section_id: 'hypercard',
    },
    {
      question_id: 'q-myst',
      prompt: 'Which famous game began life as a HyperCard stack?',
      options: ['Myst', 'Pong', 'Tetris', 'Doom'],
      correct_index: 0,
      section_id: 'hypercard',
    },
    {
      question_id: 'q-floppy-size',
      prompt: 'How much data did the common 3.5-inch floppy disk hold?',
      options: ['64 kilobytes', '1.44 megabytes', '650 megabytes', '4.7 gigabytes'],
      correct_index: 1,
      section_id: 'floppy-disks',
    },
    {
      question_id: 'q-save-icon',
      prompt: 'What does the "save" icon in many programs still look like?',
      options: ['A CD-ROM', 'A cassette tape', 'A 3.5-inch floppy disk', 'A filing cabinet'],
      correct_index: 2,
      section_id: 'floppy-disks',
    },
    {
      question_id: 'q-vga',
      prompt: 'Which screen size did the VGA standard of 1987 make common?',
      options: ['320 by 200', '640 by 480', '1280 by 1024', '1920 by 1080'],
      correct_index: 1,
      section_id: 'crt-phosphor',
    },
    {
      question_id: 'q-emulator',
      prompt: 'What is an emulator?',
      options: [
        'A program that behaves like an older machine',
        'A tool that repairs scratched discs',
        'A drive that reads floppy disks',
        'A format for storing pictures',
      ],
      correct_index: 0,
      section_id: 'preserving-software',
    },
  ],
  dungeons: [
    {
      dungeon_id: 'resurrection-keepmaze',
      title: 'The Archive of Lost Formats',
      rooms: [
        {
          room_id: 'entrance',
          name: 'Loading Dock',
          description: 'Crates of dusty disks and discs wait on a concrete platform. A bell rings as the shutter rolls up.',
          exits: [{ to: 'reading_room' }],
        },
        {
          room_id: 'reading_room',
          name: 'Reading Room',
          description: 'Long tables hold magnifiers and soft brushes. Doors lead to the vault, the stacks and the glowing hall.',
          exits: [{ to: 'entrance' }, { to: 'floppy_vault' }, { to: 'silver_stacks' }, { to: 'phosphor_hall' }],
        },
        {
          room_id: 'floppy_vault',
          name: 'Floppy Vault',
          description: 'Drawers of 3.5-inch disks line the walls, each one labeled in careful handwriting. A magnet sign warns you to keep out.',
          exits: [{ to: 'reading_room' }, { to: 'cold_storage' }],
        },
        {
          room_id: 'silver_stacks',
          name: 'Silver Stacks',
          description: 'Shelves of silver discs shimmer in their cases. Light from the aisle makes rainbows on the ceiling.',
          exits: [{ to: 'reading_room' }, { to: 'hypercard_annex' }, { to: 'imaging_bay' }],
        },
        {
          room_id: 'phosphor_hall',
          name: 'Phosphor Hall',
          description: 'Rows of beige monitors glow green and amber. A cursor blinks patiently on every screen.',
          exits: [{ to: 'reading_room' }, { to: 'hypercard_annex' }],
        },
        {
          room_id: 'hypercard_annex',
          name: 'HyperCard Annex',
          description: 'Index cards are pinned in chains across a corkboard, each one pointing to the next with a button drawn in pen.',
          exits: [{ to: 'silver_stacks' }, { to: 'phosphor_hall' }, { to: 'emulation_lab' }],
        },
        {
          room_id: 'imaging_bay',
          name: 'Imaging Bay',
          description: 'A drive hums as it copies a disc, one sector at a time, into a single careful file.',
          exits: [{ to: 'silver_stacks' }, { to: 'emulation_lab' }],
        },
        {
          room_id: 'cold_storage',
          name: 'Cold Storage',
          description: 'Sealed boxes of tapes and disks rest in cool, dry air. A frosted window shows the lights of the lab beyond.',
          exits: [{ to: 'floppy_vault' }, { to: 'emulation_lab' }],
        },
        {
          room_id: 'emulation_lab',
          name: 'Emulation Lab',
          description: 'A modern computer pretends to be a machine from 1995. A narrow door at the back is marked Master Archive.',
          exits: [{ to: 'hypercard_annex' }, { to: 'imaging_bay' }, { to: 'cold_storage' }, { to: 'throne_room' }],
        },
        {
          room_id: 'throne_room',
          name: 'The Master Archive',
          description: 'One restored disc spins in a gleaming drive, and an old program starts up as it did long ago. You have brought it back.',
          exits: [{ to: 'emulation_lab' }],
        },
      ],
    },
  ],
};

const check = validateManifest(resurrectionDisc);
if (!check.ok) {
  throw new Error(
    'resurrection disc is invalid: ' + check.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
  );
}
