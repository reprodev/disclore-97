import type { DiscManifest } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { PixelIcon } from './PixelIcon';
import '../styles/workspace.css';

export interface DiscCoverProps {
  disc: DiscManifest;
  onOpenArticle: (sectionId: string) => void;
  onOpenDiagram: (diagramId: string) => void;
  onOpenKeepMaze: (dungeonId: string) => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Welcome page shown when a disc first opens: a 1997 CD-ROM cover with quick-launch buttons. */
export function DiscCover({ disc, onOpenArticle, onOpenDiagram, onOpenKeepMaze }: DiscCoverProps) {
  const firstSection = disc.sections[0];
  const firstDiagram = disc.diagrams[0];
  const firstDungeon = disc.dungeons[0];

  return (
    <div className="disc-cover">
      <div className="disc-cover__frame">
        <PixelIcon name="cd" size={32} />
        <p className="disc-cover__kicker">Welcome to</p>
        <h2 className="disc-cover__title">{disc.title}</h2>
        <p className="disc-cover__tagline">{disc.tagline}</p>
        <hr className="disc-cover__rule" />
        <p className="disc-cover__stats">
          {plural(disc.sections.length, 'article', 'articles')} &middot;{' '}
          {plural(disc.diagrams.length, 'diagram', 'diagrams')} &middot;{' '}
          {plural(disc.trivia.length, 'trivia question', 'trivia questions')} &middot;{' '}
          {plural(disc.dungeons.length, 'dungeon', 'dungeons')}
        </p>
        <div className="disc-cover__launch">
          <BevelButton
            className="disc-cover__button"
            disabled={!firstSection}
            onClick={() => firstSection && onOpenArticle(firstSection.section_id)}
          >
            <PixelIcon name="book" />
            <span>Read the first article</span>
          </BevelButton>
          <BevelButton
            className="disc-cover__button"
            disabled={!firstDiagram}
            onClick={() => firstDiagram && onOpenDiagram(firstDiagram.diagram_id)}
          >
            <PixelIcon name="diagram" />
            <span>Explore the interactive diagram</span>
          </BevelButton>
          <BevelButton
            className="disc-cover__button"
            disabled={!firstDungeon}
            onClick={() => firstDungeon && onOpenKeepMaze(firstDungeon.dungeon_id)}
          >
            <PixelIcon name="torch" />
            <span>Enter the KeepMaze dungeon</span>
          </BevelButton>
        </div>
        <p className="disc-cover__fine">Find topics in the contents on the left, or search with Find in Disc.</p>
      </div>
    </div>
  );
}
