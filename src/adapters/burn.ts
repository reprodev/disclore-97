// Burn orchestrator: input text to a validated, mountable DiscManifest. Never throws.

import { ERROR_MESSAGES, FALLBACK_CODES, makeError, rateLimitMessage } from './errors';
import { fetchGithubSource } from './github';
import { markdownToSource, topicToSource } from './markdown';
import type { BurnError, FetchLike, Result } from './types';
import { fetchTopicSource } from './topic';
import { fetchWebpageSource } from './webpage';
import { loadDisc } from '../discs/loader';
import { compileDisc } from '../model/compiler';
import { MAX_OUTLINE_INPUT } from '../model/manifest';
import { DEFAULT_LANGUAGE, toWikiLanguage } from '../model/languages';
import type { WikiLanguage } from '../model/languages';
import type { DiscManifest, OutlineSource } from '../model/manifest';
import type { ExtractedSource } from '../model/source';
import { parseInput } from '../model/sourceInput';

export type BurnStage = 'fetching' | 'compiling' | 'validating';

export interface BurnDeps {
  fetch?: FetchLike;
  signal?: AbortSignal;
  onStage?: (s: BurnStage) => void;
  /** The Wikipedia language for a topic burn. English when omitted. */
  language?: WikiLanguage;
}

export type BurnResult = { ok: true; manifest: DiscManifest } | { ok: false; error: BurnError };

function fail(code: keyof typeof ERROR_MESSAGES, fallbackTopic?: string): BurnResult {
  return failWith(makeError(code), fallbackTopic);
}

/** Fails with an adapter's own error, keeping its message (for example a quoted rate-limit wait). */
function failWith(source: BurnError, fallbackTopic?: string): BurnResult {
  const error: BurnError = { code: source.code, message: source.message };
  if (source.retryMinutes !== undefined) error.retryMinutes = source.retryMinutes;
  if (fallbackTopic !== undefined && fallbackTopic !== '' && FALLBACK_CODES.has(source.code)) {
    error.fallbackTopic = fallbackTopic;
  }
  return { ok: false, error };
}

function stage(deps: BurnDeps, s: BurnStage): void {
  try {
    deps.onStage?.(s);
  } catch {
    // A faulty progress callback must not break the burn.
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** What to put on a freshly compiled disc before it is validated. */
interface Finish {
  /** Marks the disc as an offline outline of this source. */
  outline?: OutlineSource;
  /** Keeps this disc id, so a refreshed disc replaces the one it upgrades. */
  discId?: string;
  /** The Wikipedia language a topic disc was burned in. English is left off the manifest. */
  language?: WikiLanguage;
}

/** Compile, then gate through loadDisc(manifest, false). */
function compileAndLoad(source: ExtractedSource, deps: BurnDeps, finish: Finish = {}): BurnResult {
  stage(deps, 'compiling');
  let manifest: DiscManifest;
  try {
    // The compiler stays pure and never sees these: the outline marker and a kept id are added after it.
    manifest = compileDisc(source);
    if (finish.discId !== undefined) manifest = { ...manifest, disc_id: finish.discId };
    if (finish.outline !== undefined) manifest = { ...manifest, outline: { ...finish.outline } };
    if (finish.language !== undefined && finish.language !== DEFAULT_LANGUAGE) manifest = { ...manifest, language: finish.language };
  } catch {
    return fail('validation-failed');
  }
  stage(deps, 'validating');
  let loaded;
  try {
    loaded = loadDisc(manifest, false);
  } catch {
    return fail('validation-failed');
  }
  if (!loaded.ok) {
    return { ok: false, error: { ...makeError('validation-failed'), validation: loaded.errors } };
  }
  return { ok: true, manifest: loaded.manifest };
}

/** The outline marker for a source: the kind, and the input as entered, trimmed. */
function outlineOf(kind: OutlineSource['kind'], input: string): OutlineSource | undefined {
  const text = input.trim();
  return text === '' || text.length > MAX_OUTLINE_INPUT ? undefined : { kind, input: text };
}

interface RunOptions {
  /** A topic whose lookup fails returns that error instead of the offline outline (used by refresh). */
  strictTopic?: boolean;
  /** Keeps this disc id on the result (used by refresh). */
  discId?: string;
}

/** A topic lookup that failed during a refresh, worded for a topic rather than a web page. */
function topicRefreshError(error: BurnError, topic: string): BurnError {
  if (error.code === 'unavailable' || error.code === 'fetch-failed') {
    return {
      code: error.code,
      message: `The encyclopedia line did not answer with an article for "${topic.trim().slice(0, 80)}". Please try again later.`,
    };
  }
  return { code: error.code, message: error.message };
}

async function run(input: string, deps: BurnDeps, options: RunOptions = {}): Promise<BurnResult> {
  const { signal } = deps;
  if (signal?.aborted) return fail('cancelled');

  const parsed = parseInput(input);
  if (!parsed.ok) return fail(parsed.error);

  let source: ExtractedSource;
  let fallbackTopic: string | undefined;
  let outline: OutlineSource | undefined;
  let language: WikiLanguage | undefined;

  if (parsed.kind === 'markdown') {
    source = markdownToSource(parsed.text);
  } else if (parsed.kind === 'topic') {
    // Real encyclopedia content when /api/topic can supply it; otherwise the offline study outline.
    stage(deps, 'fetching');
    language = toWikiLanguage(deps.language);
    let found: Result<ExtractedSource>;
    try {
      found = await fetchTopicSource(parsed.text, {
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
        ...(signal ? { signal } : {}),
        language,
      });
    } catch {
      found = { ok: false, error: makeError('fetch-failed') };
    }
    if (signal?.aborted) return fail('cancelled');
    if (found.ok) {
      source = found.value;
    } else if (options.strictTopic) {
      return { ok: false, error: topicRefreshError(found.error, parsed.text) };
    } else {
      source = topicToSource(parsed.text, language);
      outline = outlineOf('topic', parsed.text);
    }
  } else {
    let res: Result<ExtractedSource>;
    const opts = { ...(deps.fetch ? { fetch: deps.fetch } : {}), ...(signal ? { signal } : {}) };
    if (parsed.kind === 'github') {
      fallbackTopic = parsed.repo;
      stage(deps, 'fetching');
      try {
        res = await fetchGithubSource(parsed.owner, parsed.repo, opts);
      } catch {
        res = { ok: false, error: makeError('fetch-failed') };
      }
    } else {
      fallbackTopic = hostOf(parsed.url);
      stage(deps, 'fetching');
      try {
        res = await fetchWebpageSource(parsed.url, opts);
      } catch {
        res = { ok: false, error: makeError('fetch-failed') };
      }
    }
    if (signal?.aborted) return fail('cancelled');
    if (!res.ok) return failWith(res.error, fallbackTopic);
    source = res.value;
  }

  if (signal?.aborted) return fail('cancelled');
  const result = compileAndLoad(source, deps, {
    ...(outline ? { outline } : {}),
    ...(options.discId !== undefined ? { discId: options.discId } : {}),
    ...(language !== undefined ? { language } : {}),
  });
  if (signal?.aborted) return fail('cancelled');
  return result;
}

export async function burn(input: string, deps: BurnDeps = {}): Promise<BurnResult> {
  try {
    return await run(input, deps);
  } catch {
    return fail(deps.signal?.aborted ? 'cancelled' : 'fetch-failed');
  }
}

/**
 * Burns the offline study outline for a topic. `origin` is the source the outline stands in for
 * (the GitHub or web page address that could not be read). It is kept on the disc so the disc can be
 * refreshed into the full one later. Without it, the topic itself is recorded.
 */
export async function burnFallback(
  fallbackTopic: string,
  deps: BurnDeps = {},
  origin?: OutlineSource,
): Promise<BurnResult> {
  try {
    if (deps.signal?.aborted) return fail('cancelled');
    const outline = origin ? outlineOf(origin.kind, origin.input) : outlineOf('topic', fallbackTopic);
    const result = compileAndLoad(topicToSource(fallbackTopic), deps, outline ? { outline } : {});
    if (deps.signal?.aborted) return fail('cancelled');
    return result;
  } catch {
    return fail('validation-failed');
  }
}

/**
 * Burns the full disc for an offline outline from the source it saved. On success the new disc keeps
 * the outline's disc_id, so notes, bookmarks, and the Personal Best stay with it, and it carries no
 * outline marker. On any failure (still rate-limited, offline, no article) it returns the error, and
 * the caller keeps the outline as it is. Never throws.
 */
export async function refreshDisc(disc: DiscManifest, deps: BurnDeps = {}): Promise<BurnResult> {
  try {
    const origin = disc.outline;
    if (!origin) return fail('validation-failed');
    // A disc image can be edited by hand, so the saved input must still read as the kind it claims.
    const parsed = parseInput(origin.input);
    if (!parsed.ok || parsed.kind !== origin.kind) return fail('validation-failed');
    if (deps.signal?.aborted) return fail('cancelled');
    // A topic disc refreshes from the same Wikipedia language it was burned in.
    const result = await run(origin.input, { ...deps, language: toWikiLanguage(disc.language) }, { strictTopic: true, discId: disc.disc_id });
    if (!result.ok) {
      // A refresh offers no Burn offline button: the outline already is the offline disc.
      const error: BurnError =
        result.error.code === 'rate-limited'
          ? { ...result.error, message: rateLimitMessage(result.error.retryMinutes, false) }
          : result.error;
      delete error.fallbackTopic;
      return { ok: false, error };
    }
    if (result.manifest.outline !== undefined) return fail('fetch-failed');
    return result;
  } catch {
    return fail(deps.signal?.aborted ? 'cancelled' : 'fetch-failed');
  }
}
