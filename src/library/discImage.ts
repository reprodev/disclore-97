/**
 * Disc images: any disc saved to, or mounted from, a plain .json file.
 *
 * A disc image is just a DiscManifest as JSON. Mounting never trusts the file: it goes
 * through JSON.parse and then loadDisc(parsed, false), the same validator every burned disc
 * passes, which also enforces the safe-media rules.
 */
import { loadDisc } from '../discs/loader';
import type { DiscManifest, ValidationError } from '../model/manifest';

/** Largest file that will be read. Real discs are far smaller. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** How many validation problems a rejection reports. */
export const MAX_REPORTED_ERRORS = 8;

export type DiscImageResult =
  | { ok: true; manifest: DiscManifest }
  | { ok: false; message: string; errors: ValidationError[] };

/** Pretty-printed JSON for a disc, ready to write to a file. */
export function serializeDiscImage(m: DiscManifest): string {
  return JSON.stringify(m, null, 2) + '\n';
}

/** A safe file name for a disc, for example `castles.json`. */
export function discImageFileName(m: DiscManifest): string {
  const base = m.disc_id
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'disc'}.json`;
}

const reject = (message: string, errors: ValidationError[] = []): DiscImageResult => ({
  ok: false,
  message,
  errors,
});

/**
 * Turns the text of a .json file into a validated disc. Never throws. A rejection carries a
 * plain-language message and, for a file that parsed but failed validation, the first problems found.
 */
export function parseDiscImage(text: unknown): DiscImageResult {
  if (typeof text !== 'string') return reject('The file could not be read.');
  if (text.length > MAX_IMAGE_BYTES) return reject('That file is too large to be a disc image.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return reject("That file is not valid JSON, so it cannot be a disc image.");
  }

  const result = loadDisc(parsed, false);
  if (!result.ok) {
    return reject(
      "That file is not a DiscLore '97 disc image, or it did not pass the disc safety checks.",
      result.errors.slice(0, MAX_REPORTED_ERRORS),
    );
  }
  return { ok: true, manifest: result.manifest };
}

/** Reads a File as text. Rejects when the file cannot be read. */
export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(file);
  });
}

/** Offers `text` to the user as a downloaded file. Returns false when the browser cannot do it. */
export function saveTextFile(fileName: string, text: string, mime = 'application/json'): boolean {
  try {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the download a moment to start before the address is released.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  } catch {
    return false;
  }
}
