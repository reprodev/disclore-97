const BLOCKS = 16;
/** Seconds per block: about 1.6 s total, a quick 4x drive spin-up. */
const STEP = 0.1;

/**
 * Brief "reading disc" progress bar shown when a disc opens. Pure CSS: the
 * blocks appear in sequence, then the bar collapses. It never delays the disc
 * contents. Remount with a new `key` to replay.
 */
export function SpinUpBar() {
  return (
    <div className="spinup" role="progressbar" aria-label="Reading disc at 4x speed" aria-busy="true">
      <span>Reading disc... 4x</span>
      <div className="spinup__track" aria-hidden="true">
        {Array.from({ length: BLOCKS }, (_, i) => (
          <span key={i} className="spinup__block" style={{ animationDelay: `${(i * STEP).toFixed(2)}s` }} />
        ))}
      </div>
    </div>
  );
}
