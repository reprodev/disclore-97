import { useMemo, useState } from 'react';
import { ArticleViewer } from './components/ArticleViewer';
import { DiscBrowser } from './components/DiscBrowser';
import { ErrorList } from './components/ErrorList';
import { HotspotViewer } from './components/HotspotViewer';
import { KeepMazeUI } from './components/KeepMazeUI';
import { MuteToggle } from './components/MuteToggle';
import { Window } from './components/Window';
import { prebakedDiscs } from './discs';
import { loadDisc } from './discs/loader';
import type { DiscManifest, ValidationError } from './model/manifest';

export type View =
  | { kind: 'section'; section_id: string }
  | { kind: 'diagram'; diagram_id: string }
  | { kind: 'keepmaze'; dungeon_id: string };

export interface NavState {
  discId: string | null;
  view: View | null;
}

export const initialNav: NavState = { discId: null, view: null };

/**
 * Selects a section. An unknown id leaves the state unchanged (same object)
 * and reports not-found.
 */
export function selectSection(
  state: NavState,
  disc: DiscManifest | undefined,
  sectionId: string,
): { state: NavState; notFound: string | null } {
  if (!disc || !disc.sections.some((s) => s.section_id === sectionId)) {
    return { state, notFound: `Section not found: ${sectionId}` };
  }
  return { state: { ...state, view: { kind: 'section', section_id: sectionId } }, notFound: null };
}

export interface AppProps {
  /** Disc sources; defaults to the pre-baked discs. Every source goes through loadDisc. */
  sources?: readonly unknown[];
}

export function App({ sources = prebakedDiscs }: AppProps) {
  const [nav, setNav] = useState<NavState>(initialNav);
  const [notFound, setNotFound] = useState<string | null>(null);

  const { discs, failures } = useMemo(() => {
    const ok: DiscManifest[] = [];
    const bad: ValidationError[][] = [];
    for (const src of sources) {
      const r = loadDisc(src, false);
      if (r.ok) ok.push(r.manifest);
      else bad.push(r.errors);
    }
    return { discs: ok, failures: bad };
  }, [sources]);

  const disc = discs.find((d) => d.disc_id === nav.discId);

  const goSection = (sectionId: string) => {
    const r = selectSection(nav, disc, sectionId);
    setNotFound(r.notFound);
    if (r.state !== nav) setNav(r.state);
  };

  let viewWindow = null;
  if (disc && nav.view) {
    const v = nav.view;
    const close = () => setNav({ ...nav, view: null });
    if (v.kind === 'section') {
      const section = disc.sections.find((s) => s.section_id === v.section_id);
      viewWindow = (
        <Window title={section?.title ?? 'Article'} onClose={close}>
          <ArticleViewer sections={disc.sections} sectionId={v.section_id} />
        </Window>
      );
    } else if (v.kind === 'diagram') {
      const diagram = disc.diagrams.find((d) => d.diagram_id === v.diagram_id);
      if (diagram) {
        viewWindow = (
          <Window title={diagram.title} onClose={close}>
            <HotspotViewer diagram={diagram} onNavigate={goSection} />
          </Window>
        );
      }
    } else {
      const dungeon = disc.dungeons.find((d) => d.dungeon_id === v.dungeon_id);
      if (dungeon) {
        viewWindow = (
          <Window title={dungeon.title} onClose={close}>
            <KeepMazeUI
              key={`${disc.disc_id}/${dungeon.dungeon_id}`}
              disc={disc}
              dungeon={dungeon}
              onOpenSection={goSection}
            />
          </Window>
        );
      }
    }
  }

  return (
    <div className="app-shell">
      <div className="app-toolbar">
        <MuteToggle />
      </div>
      <DiscBrowser
        discs={discs}
        openDiscId={nav.discId}
        onOpenDisc={(discId) => {
          setNotFound(null);
          setNav({ discId, view: null });
        }}
        onCloseDisc={() => {
          setNotFound(null);
          setNav(initialNav);
        }}
        onSelectSection={goSection}
        onSelectDiagram={(diagram_id) => {
          setNotFound(null);
          setNav({ ...nav, view: { kind: 'diagram', diagram_id } });
        }}
        onSelectDungeon={(dungeon_id) => {
          setNotFound(null);
          setNav({ ...nav, view: { kind: 'keepmaze', dungeon_id } });
        }}
      />
      {notFound ? (
        <p role="alert" className="app-not-found">
          {notFound}
        </p>
      ) : null}
      {viewWindow}
      {failures.map((errors, i) => (
        <ErrorList key={i} errors={errors} />
      ))}
    </div>
  );
}
