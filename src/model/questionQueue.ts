/**
 * Shuffled-bag question queue (Requirement 12.7).
 * Plain, immutable data: `remaining` holds indices into the caller's question list
 * that have not been drawn from the current bag yet. Draws never mutate the queue.
 */
export type QuestionQueue = { readonly remaining: readonly number[] };

/** Fisher-Yates shuffle of 0..count-1 using the injected rng (values in [0, 1)). */
export function shuffledIndices(count: number, rng: () => number): number[] {
  const a = Array.from({ length: Math.max(0, count) }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A fresh queue holding a full shuffled bag of `count` questions. */
export function createQueue(count: number, rng: () => number): QuestionQueue {
  return { remaining: shuffledIndices(count, rng) };
}

/**
 * Draw the next question index without replacement. When the bag is empty it is
 * reshuffled first, so no index repeats until all `count` have been drawn.
 * Returns the drawn index and the next queue. Throws if `count` < 1.
 */
export function drawQuestion(
  queue: QuestionQueue,
  count: number,
  rng: () => number,
): { index: number; queue: QuestionQueue } {
  if (count < 1) throw new RangeError('drawQuestion requires at least one question');
  const bag = queue.remaining.length > 0 ? queue.remaining : shuffledIndices(count, rng);
  const [index, ...rest] = bag;
  return { index, queue: { remaining: rest } };
}
