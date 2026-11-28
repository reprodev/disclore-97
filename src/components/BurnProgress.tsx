import { useT } from '../i18n/LocaleContext';

const BLOCK_COUNT = 20;
const BLOCK_IDS = Array.from({ length: BLOCK_COUNT }, (_, i) => i);

/** Indeterminate burn indicator made of flat blocks, announced via a live region. */
export function BurnProgress() {
  const tr = useT();
  return (
    <div className="burn-progress">
      <p role="status" aria-live="polite">
        {tr('burn_progress')}
      </p>
      <div
        className="burn-progress__bar"
        role="progressbar"
        aria-label="Burn progress"
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {BLOCK_IDS.map((i) => (
          <span key={i} className="burn-progress__block" aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
