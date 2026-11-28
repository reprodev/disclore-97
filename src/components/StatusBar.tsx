import { useT } from '../i18n/LocaleContext';
import '../styles/workspace.css';

export interface StatusBarProps {
  discTitle: string;
  /** Current view, for example "Section: The Keep" or "Contents". */
  viewLabel: string;
}

/**
 * Three inset panels: disc, current view, CD-ROM state. The CD-ROM panel
 * shows "Reading" for the first moments, then "Ready", using CSS timing only.
 * It is not a live region, so it never announces itself.
 */
export function StatusBar({ discTitle, viewLabel }: StatusBarProps) {
  const tr = useT();
  return (
    <div className="status-bar" role="group" aria-label="Status bar">
      <div className="status-bar__panel status-bar__panel--disc">{tr('status_disc', { title: discTitle })}</div>
      <div className="status-bar__panel status-bar__panel--view">{viewLabel}</div>
      <div className="status-bar__panel status-bar__panel--cd">
        <span>CD-ROM: </span>
        <span className="status-bar__cd-state">
          <span className="status-bar__cd-reading" aria-hidden="true">
            Reading 4x
          </span>
          <span className="status-bar__cd-ready">{tr('status_ready')}</span>
        </span>
      </div>
    </div>
  );
}
