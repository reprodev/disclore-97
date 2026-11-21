// Burn orchestrator: input text to a validated, mountable DiscManifest. Never throws.

import { ERROR_MESSAGES, FALLBACK_CODES, makeError } from './errors';
import { fetchGithubSource } from './github';
import { markdownToSource, topicToSource } from './markdown';
import type { BurnError, FetchLike, Result } from './types';
import { fetchWebpageSource } from './webpage';
import { loadDisc } from '../discs/loader';
import { compileDisc } from '../model/compiler';
import type { DiscManifest } from '../model/manifest';
import type { ExtractedSource } from '../model/source';
import { parseInput } from '../model/sourceInput';

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

async function run(input: string, deps: BurnDeps): Promise<BurnResult> {
  const { signal } = deps;
  if (signal?.aborted) return fail('cancelled');

  const parsed = parseInput(input);
  if (!parsed.ok) return fail(parsed.error);

  let source: ExtractedSource;
  let fallbackTopic: string | undefined;

  if (parsed.kind === 'markdown') {
    source = markdownToSource(parsed.text);
  } else if (parsed.kind === 'topic') {
    source = topicToSource(parsed.text);
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
    if (!res.ok) return fail(res.error.code, fallbackTopic);
    source = res.value;
  }

  if (signal?.aborted) return fail('cancelled');
  const result = compileAndLoad(source, deps);
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
