import { useEffect, useState } from 'react';
import { playSlideClick } from '../audio/audio';
import type { DiscManifest } from '../model/manifest';
import { MediaViewerModal } from './MediaViewerModal';
import { Plate, PlateImage } from './Plate';
import '../styles/dictionary.css';

export interface MediaGalleryProps {
  disc: DiscManifest;
  /** Opens one article of the disc. Used by the Plate cards of a disc with no pictures. */
  onOpenSection: (sectionId: string) => void;
}

/**
 * Contact sheet for the open disc. A disc with extracted pictures shows each one with its
 * caption, and a click opens the Pop-Out Picture Viewer at that frame. A disc without pictures
 * (the built-in discs, or any offline burn) shows each article's SVG plate, and a click opens
 * that article.
 */
export function MediaGallery({ disc, onOpenSection }: MediaGalleryProps) {
  const media = disc.media ?? [];
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());

  // A different disc is a different gallery.
  useEffect(() => {
    setViewerAt(null);
    setBroken(new Set());
    setLoaded(new Set());
  }, [disc.disc_id]);

  const markBroken = (url: string) => setBroken((b) => (b.has(url) ? b : new Set(b).add(url)));
  const markLoaded = (url: string) => setLoaded((l) => (l.has(url) ? l : new Set(l).add(url)));
  const step = (d: number) => setIndex((i) => (i + d + media.length) % Math.max(media.length, 1));
  const fallbackKind = disc.sections[0]?.plate;

  return (
    <section className="media-gallery" aria-label="Media Gallery">
      <h1 className="media-gallery__title">Media Gallery</h1>
      {media.length > 0 ? (
        <>
          <p className="media-gallery__lede">
            {media.length} {media.length === 1 ? 'picture' : 'pictures'} on {disc.title}. Choose one to enlarge it.
          </p>
          <ul className="media-gallery__grid">
            {media.map((m, i) => (
              <li key={`${i}-${m.url}`}>
                <button
                  type="button"
                  className="media-gallery__card"
                  aria-label={`Open picture ${i + 1}: ${m.caption}`}
                  onClick={() => {
                    playSlideClick();
                    setIndex(i);
                    setViewerAt(i);
                  }}
                >
                  {broken.has(m.url) ? (
                    <span className="media-gallery__broken" aria-hidden="true">
                      <PlateImage kind={fallbackKind} label="" />
                    </span>
                  ) : (
                    <img
                      className="media-gallery__thumb"
                      src={m.url}
                      alt=""
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onLoad={() => markLoaded(m.url)}
                      onError={() => markBroken(m.url)}
                    />
                  )}
                  <span className="media-gallery__caption">{m.caption}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="media-gallery__lede">
            This disc carries no pictures, so each article is shown by its plate. Choose one to read it.
          </p>
          <ul className="media-gallery__grid">
            {disc.sections.map((s) => (
              <li key={s.section_id}>
                <button
                  type="button"
                  className="media-gallery__card"
                  aria-label={`Open article: ${s.title}`}
                  onClick={() => onOpenSection(s.section_id)}
                >
                  <span className="media-gallery__plate" aria-hidden="true">
                    <PlateImage kind={s.plate} label="" />
                  </span>
                  <span className="media-gallery__caption">{`Plate: ${s.title}`}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {viewerAt !== null && media.length > 0 ? (
        <MediaViewerModal
          title={disc.title}
          media={media}
          index={Math.min(index, media.length - 1)}
          broken={broken}
          loaded={loaded}
          fallback={(caption) => <Plate kind={fallbackKind} caption={caption} />}
          onStep={step}
          onSelect={setIndex}
          onLoad={markLoaded}
          onError={markBroken}
          onClose={() => setViewerAt(null)}
        />
      ) : null}
    </section>
  );
}
