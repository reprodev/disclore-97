import { PixelIcon } from './PixelIcon';
import '../styles/workspace.css';

export interface BreadcrumbProps {
  discTitle: string;
  /** Path below the disc, for example ["Sections", "The Keep"]. Empty at the disc home. */
  trail: string[];
  onHome: () => void;
}

/** Inset topic breadcrumb. Only the disc crumb is a control. */
export function Breadcrumb({ discTitle, trail, onHome }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label="Topic breadcrumb">
      <span className="breadcrumb__label">Topic:</span>
      <button type="button" className="breadcrumb__crumb" aria-label="Go to disc contents" onClick={onHome}>
        <PixelIcon name="cd" />
        <span aria-hidden="true">{discTitle}</span>
      </button>
      {trail.map((part, i) => (
        <span key={i} className="breadcrumb__part">
          <span className="breadcrumb__sep" aria-hidden="true">
            &gt;
          </span>
          <span className={i === trail.length - 1 ? 'breadcrumb__current' : undefined}>{part}</span>
        </span>
      ))}
    </nav>
  );
}
