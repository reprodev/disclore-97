import { playSpinUp } from '../audio/audio';
import type { DiscManifest } from '../model/manifest';
import { BevelButton } from './BevelButton';
import { PixelIcon } from './PixelIcon';
import { SpinUpBar } from './SpinUpBar';
import { Window } from './Window';
import '../styles/browser.css';

export interface DiscBrowserProps {
  discs: DiscManifest[];
  /** Id of the open disc, or null when only the disc list is shown. */
  openDiscId: string | null;
  onOpenDisc: (discId: string) => void;
  onCloseDisc: () => void;
  onSelectSection: (sectionId: string) => void;
  onSelectDiagram: (diagramId: string) => void;
  onSelectDungeon: (dungeonId: string) => void;
}

export function DiscBrowser({
  discs,
  openDiscId,
  onOpenDisc,
  onCloseDisc,
  onSelectSection,
  onSelectDiagram,
  onSelectDungeon,
}: DiscBrowserProps) {
  const open = openDiscId === null ? undefined : discs.find((d) => d.disc_id === openDiscId);

  const handleOpen = (discId: string) => {
    playSpinUp();
    onOpenDisc(discId);
  };

  return (
    <div className="disc-browser">
      <ul className="disc-list" aria-label="Discs">
        {discs.map((disc) => (
          <li key={disc.disc_id} className="disc-list-item">
            <BevelButton
              className="disc-open"
              aria-pressed={disc.disc_id === openDiscId}
              onClick={() => handleOpen(disc.disc_id)}
            >
              <PixelIcon name="cd" size={32} />
              <span className="disc-text">
                <span className="disc-title">{disc.title}</span>
                <span className="disc-tagline">{disc.tagline}</span>
              </span>
            </BevelButton>
          </li>
        ))}
      </ul>

      {open ? (
        <Window title={open.title} onClose={onCloseDisc} className="disc-window">
          <SpinUpBar key={open.disc_id} />
          <nav className="disc-tree" aria-label={open.title}>
            <section className="disc-group">
              <h2 className="disc-group-title">
                <PixelIcon name="book" />
                Sections
              </h2>
              <ul>
                {open.sections.map((s) => (
                  <li key={s.section_id}>
                    <BevelButton className="disc-entry" onClick={() => onSelectSection(s.section_id)}>
                      <PixelIcon name="book" />
                      <span>{s.title}</span>
                    </BevelButton>
                  </li>
                ))}
              </ul>
            </section>

            <section className="disc-group">
              <h2 className="disc-group-title">
                <PixelIcon name="diagram" />
                Diagrams
              </h2>
              <ul>
                {open.diagrams.map((d) => (
                  <li key={d.diagram_id}>
                    <BevelButton className="disc-entry" onClick={() => onSelectDiagram(d.diagram_id)}>
                      <PixelIcon name="diagram" />
                      <span>{d.title}</span>
                    </BevelButton>
                  </li>
                ))}
              </ul>
            </section>

            <section className="disc-group">
              <h2 className="disc-group-title">
                <PixelIcon name="key" />
                Trivia
              </h2>
              <ul>
                {open.trivia.map((q) => (
                  <li key={q.question_id} className="disc-trivia-item">
                    {q.prompt}
                  </li>
                ))}
              </ul>
            </section>

            <section className="disc-group">
              <h2 className="disc-group-title">
                <PixelIcon name="torch" />
                Dungeons
              </h2>
              <ul>
                {open.dungeons.map((d) => (
                  <li key={d.dungeon_id}>
                    <BevelButton className="disc-entry" onClick={() => onSelectDungeon(d.dungeon_id)}>
                      <PixelIcon name="torch" />
                      <span>{d.title}</span>
                    </BevelButton>
                  </li>
                ))}
              </ul>
            </section>
          </nav>
        </Window>
      ) : null}
    </div>
  );
}
