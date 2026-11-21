import { describe, expect, it } from 'vitest';
import { parseInput } from '../../src/model/sourceInput';

describe('parseInput', () => {
  it('classifies a github URL', () => {
    expect(parseInput('https://github.com/owner/repo')).toEqual({
      ok: true, kind: 'github', owner: 'owner', repo: 'repo', url: 'https://github.com/owner/repo',
    });
  });

  it('handles www. prefix, .git suffix and sub-paths', () => {
    expect(parseInput('https://www.github.com/o/r.git')).toMatchObject({ kind: 'github', owner: 'o', repo: 'r', url: 'https://github.com/o/r' });
    expect(parseInput('https://github.com/o/r/tree/main/src')).toMatchObject({ kind: 'github', owner: 'o', repo: 'r' });
  });

  it('classifies a webpage URL', () => {
    expect(parseInput('https://example.com/page#frag')).toEqual({ ok: true, kind: 'webpage', url: 'https://example.com/page' });
  });

  it('classifies multi-line / heading text as markdown', () => {
    expect(parseInput('# Title\nbody')).toEqual({ ok: true, kind: 'markdown', text: '# Title\nbody' });
    expect(parseInput('line one\nline two')).toMatchObject({ kind: 'markdown' });
  });

  it('classifies plain text as a topic', () => {
    expect(parseInput('  Medieval   castles ')).toEqual({ ok: true, kind: 'topic', text: 'Medieval castles' });
  });

  it('keeps "Rust: a language" as a topic', () => {
    expect(parseInput('Rust: a language')).toEqual({ ok: true, kind: 'topic', text: 'Rust: a language' });
  });

  it('returns empty-input for blank input', () => {
    expect(parseInput('   \n ')).toEqual({ ok: false, error: 'empty-input' });
  });

  it('returns input-too-long over the limit', () => {
    expect(parseInput('a'.repeat(20001))).toEqual({ ok: false, error: 'input-too-long' });
  });

  it('returns unsupported-scheme for javascript: and ftp://', () => {
    expect(parseInput('javascript:alert(1)')).toEqual({ ok: false, error: 'unsupported-scheme' });
    expect(parseInput('ftp://example.com/x')).toEqual({ ok: false, error: 'unsupported-scheme' });
  });

  it('returns invalid-github-url when repo is dot-only after stripping .git', () => {
    expect(parseInput('https://github.com/owner/...git')).toEqual({ ok: false, error: 'invalid-github-url' });
    expect(parseInput('https://github.com/owner/.git')).toEqual({ ok: false, error: 'invalid-github-url' });
  });

  it('strips .git suffix from a normal repo', () => {
    expect(parseInput('https://github.com/owner/repo.git')).toMatchObject({ ok: true, kind: 'github', repo: 'repo' });
  });

  it('returns invalid-github-url for owner-only URL', () => {
    expect(parseInput('https://github.com/owner')).toEqual({ ok: false, error: 'invalid-github-url' });
  });

  it('falls back to topic for bare "http://"', () => {
    expect(parseInput('http://')).toEqual({ ok: true, kind: 'topic', text: 'http://' });
  });
});
