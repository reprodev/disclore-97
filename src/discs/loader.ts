import type { DiscManifest, ValidationResult } from '../model/manifest';
import { validateManifest } from '../model/validate';

/**
 * Loads a disc. Pre-baked manifests pass through untouched; any other source
 * is validated and yields either `{ ok: true, manifest }` or `{ ok: false, errors }`.
 */
export function loadDisc(source: unknown, prebaked: boolean): ValidationResult {
  if (prebaked) return { ok: true, manifest: source as DiscManifest };
  return validateManifest(source);
}
