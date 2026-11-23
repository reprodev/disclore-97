// Burn orchestrator: input text to a validated, mountable DiscManifest. Never throws.

import { ERROR_MESSAGES, FALLBACK_CODES, makeError } from './errors';
import { fetchGithubSource } from './github';
import { markdownToSource, topicToSource } from './markdown';
import type { BurnError, BurnErrorCode, FetchLike, Result } from './types';
import { fetchTopicSource } from './topic';
import { fetchWebpageSource } from './webpage';
import { loadDisc } from '../discs/loader';
import { compileDisc } from '../model/compiler';
import type { DiscManifest } from '../model/manifest';
import type { ExtractedSource } from '../model/source';
import { parseInput } from '../model/sourceInput';
import { MAX_STITCH, MIN_STITCH, stitchSources } from '../model/stitch';

export type BurnStage = 'fetching' | 'compiling' | 'validating';

export interface BurnDeps {
  fetch?: FetchLike;
  signal?: AbortSignal;
  onStage?: (s: BurnStage) => void;
}

export type BurnResult = { ok: true; manifest: DiscManifest } | { ok: false; error: BurnError };

function fail(code: keyof typeof ERROR_MESSAGES, fallbackTopic?: string): BurnResult {
  const error = makeError(code);
  if (fallbackTopic !== undefined && fallbackTopic !== '' && FALLBACK_CODES.has(code)) {
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

/** Compile, then gate through loadDisc(manifest, false). */
function compileAndLoad(source: ExtractedSource, deps: BurnDeps): BurnResult {
  stage(deps, 'compiling');
  let manifest: DiscManifest;
  try {
    manifest = compileDisc(source);
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

type Resolved =
  | { ok: true; source: ExtractedSource }
  | { ok: false; code: BurnErrorCode; fallbackTopic?: string };

/**
 * Reads one input into an ExtractedSource. Markdown is parsed locally. A topic is looked up through
 * /api/topic, with the offline study outline when that fails. A GitHub repository or a web page is
 * fetched, and a failure names a fallback topic for the offline burn. Never throws.
 */
async function resolveSource(input: string, deps: BurnDeps): Promise<Resolved> {
  const { signal } = deps;
  if (signal?.aborted) return { ok: false, code: 'cancelled' };
  const parsed = parseInput(input);
  if (!parsed.ok) return { ok: false, code: parsed.error };
  if (parsed.kind === 'markdown') return { ok: true, source: markdownToSource(parsed.text) };
  const opts = { ...(deps.fetch ? { fetch: deps.fetch } : {}), ...(signal ? { signal } : {}) };
  stage(deps, 'fetching');
  if (parsed.kind === 'topic') {
    // Real encyclopedia content when /api/topic can supply it; otherwise the offline study outline.
    let found: Result<ExtractedSource>;
    try {
      found = await fetchTopicSource(parsed.text, opts);
    } catch {
      found = { ok: false, error: makeError('fetch-failed') };
    }
    if (signal?.aborted) return { ok: false, code: 'cancelled' };
    return { ok: true, source: found.ok ? found.value : topicToSource(parsed.text) };
  }
  const fallbackTopic = parsed.kind === 'github' ? parsed.repo : hostOf(parsed.url);
  let res: Result<ExtractedSource>;
  try {
    res =
      parsed.kind === 'github'
        ? await fetchGithubSource(parsed.owner, parsed.repo, opts)
        : await fetchWebpageSource(parsed.url, opts);
  } catch {
    res = { ok: false, error: makeError('fetch-failed') };
  }
  if (signal?.aborted) return { ok: false, code: 'cancelled' };
  if (!res.ok) return { ok: false, code: res.error.code, fallbackTopic };
  return { ok: true, source: res.value };
}

async function run(input: string, deps: BurnDeps): Promise<BurnResult> {
  const resolved = await resolveSource(input, deps);
  if (!resolved.ok) return fail(resolved.code, resolved.fallbackTopic);
  if (deps.signal?.aborted) return fail('cancelled');
  const result = compileAndLoad(resolved.source, deps);
  if (deps.signal?.aborted) return fail('cancelled');
  return result;
}

/** Shown when a stitched burn has too few or too many filled rows. */
export const STITCH_MESSAGE = `A stitched CD-R needs ${MIN_STITCH} to ${MAX_STITCH} sources. Fill in at least ${MIN_STITCH} rows.`;

/**
 * Burns one disc from 2 to 4 inputs (any mix of topics, GitHub repositories, web pages, and
 * Markdown). Each input is read as a single burn would read it, all at once. A topic falls back to
 * its offline study outline, and any other failure stops the burn with a message that names the
 * source. The inputs are stitched by stitchSources(), compiled, and gated through
 * loadDisc(manifest, false). Blank rows are ignored. Cancelling through the signal stops it cleanly.
 * Never throws.
 */
export async function burnStitchedDisc(
  inputs: readonly string[],
  customTitle: string | undefined,
  deps: BurnDeps = {},
): Promise<BurnResult> {
  const { signal } = deps;
  try {
    if (signal?.aborted) return fail('cancelled');
    const rows = (Array.isArray(inputs) ? inputs : []).filter(
      (s): s is string => typeof s === 'string' && s.trim() !== '',
    );
    if (rows.length < MIN_STITCH || rows.length > MAX_STITCH) {
      return { ok: false, error: { code: 'empty-input', message: STITCH_MESSAGE } };
    }
    // One progress report for the whole fetch, not one per source.
    let fetching = false;
    const shared: BurnDeps = {
      ...deps,
      onStage: (s) => {
        if (s === 'fetching' && !fetching) {
          fetching = true;
          stage(deps, s);
        }
      },
    };
    const resolved = await Promise.all(rows.map((row) => resolveSource(row, shared)));
    if (signal?.aborted) return fail('cancelled');
    const sources: ExtractedSource[] = [];
    for (let i = 0; i < resolved.length; i++) {
      const r = resolved[i]!;
      if (!r.ok) {
        if (r.code === 'cancelled') return fail('cancelled');
        return { ok: false, error: { code: r.code, message: `Source ${i + 1}: ${ERROR_MESSAGES[r.code]}` } };
      }
      sources.push(r.source);
    }
    const result = compileAndLoad(stitchSources(sources, customTitle), deps);
    if (signal?.aborted) return fail('cancelled');
    return result;
  } catch {
    return fail(signal?.aborted ? 'cancelled' : 'fetch-failed');
  }
}

export async function burn(input: string, deps: BurnDeps = {}): Promise<BurnResult> {
  try {
    return await run(input, deps);
  } catch {
    return fail(deps.signal?.aborted ? 'cancelled' : 'fetch-failed');
  }
}

export async function burnFallback(fallbackTopic: string, deps: BurnDeps = {}): Promise<BurnResult> {
  try {
    if (deps.signal?.aborted) return fail('cancelled');
    const result = compileAndLoad(topicToSource(fallbackTopic), deps);
    if (deps.signal?.aborted) return fail('cancelled');
    return result;
  } catch {
    return fail('validation-failed');
  }
}
