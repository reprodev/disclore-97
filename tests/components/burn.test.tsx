// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BurnDialog } from '../../src/components/BurnDialog';
import { BURN_PRESETS } from '../../src/components/burnPresets';
import { parseInput } from '../../src/model/sourceInput';
import { __setContextFactory, setMuted } from '../../src/audio/audio';
import type { DiscManifest } from '../../src/model/manifest';
import type { FetchLike } from '../../src/adapters/types';

const forced = vi.hoisted(() => ({ errors: null as null | { path: string; message: string }[] }));

vi.mock('../../src/discs/loader', async (orig) => {
  const real = await orig<typeof import('../../src/discs/loader')>();
  return {
    ...real,
    loadDisc: (source: unknown, prebaked: boolean) =>
      forced.errors ? { ok: false, errors: forced.errors } : real.loadDisc(source, prebaked),
  };
});

interface Counters {
  created: number;
  started: number;
  contexts: number;
}
function param() {
  return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} };
}
function makeMock(c: Counters): () => AudioContext {
  return () => {
    c.contexts++;
    const source = () => {
      c.created++;
      return {
        type: 'sine',
        buffer: null,
        frequency: param(),
        onended: null as null | (() => void),
        connect() {},
        disconnect() {},
        start() {
          c.started++;
        },
        stop() {},
      };
    };
    return {
      state: 'running',
      currentTime: 0,
      sampleRate: 8000,
      destination: {},
      resume: () => Promise.resolve(),
      createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
      createOscillator: source,
      createBufferSource: source,
      createBuffer: (_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
      createBiquadFilter: () => ({ type: 'lowpass', frequency: param(), connect() {}, disconnect() {} }),
    } as unknown as AudioContext;
  };
}

let counters: Counters;
beforeEach(() => {
  counters = { contexts: 0, created: 0, started: 0 };
  forced.errors = null;
  setMuted(false);
  __setContextFactory(makeMock(counters));
});
afterEach(() => {
  cleanup();
  forced.errors = null;
  setMuted(false);
  __setContextFactory(null);
});

const failingFetch: FetchLike = () => Promise.reject(new TypeError('offline'));

function setup(props: Partial<Parameters<typeof BurnDialog>[0]> = {}) {
  const onBurned = vi.fn<(m: DiscManifest) => void>();
  const onClose = vi.fn();
  const utils = render(
    <BurnDialog onBurned={onBurned} onClose={onClose} fetch={failingFetch} minBurnMs={0} {...props} />,
  );
  return { onBurned, onClose, ...utils };
}

const input = () => screen.getByRole('textbox') as HTMLTextAreaElement;
const burnBtn = () => screen.getByRole('button', { name: 'Burn' }) as HTMLButtonElement;

describe('BurnDialog', () => {
  it('has dialog role, name, labelled textbox, presets list and buttons (13.5, 13.16)', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Presets' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(burnBtn()).toBeTruthy();
  });

  it('selecting a preset fills the input (13.6)', async () => {
    const user = userEvent.setup();
    setup();
    const preset = BURN_PRESETS[0]!;
    await user.click(screen.getByRole('button', { name: preset.label }));
    expect(input().value).toBe(preset.text);
    expect(burnBtn().disabled).toBe(false);
  });

  it('disables Burn for empty and whitespace input (13.7)', async () => {
    const user = userEvent.setup();
    setup();
    expect(burnBtn().disabled).toBe(true);
    await user.type(input(), '   ');
    expect(burnBtn().disabled).toBe(true);
    await user.type(input(), 'x');
    expect(burnBtn().disabled).toBe(false);
  });

  it('shows progress and disables input, presets and Burn while burning (13.8, 13.9)', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const pending: FetchLike = (_u, init) =>
      new Promise((_res, rej) => {
        release = () => rej(new TypeError('x'));
        init?.signal?.addEventListener('abort', () => rej(new DOMException('a', 'AbortError')));
      });
    setup({ fetch: pending });
    await user.click(screen.getByRole('button', { name: BURN_PRESETS[0]!.label }));
    await user.click(burnBtn());
    expect(screen.getByText('Burning CD-R at 4x...')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(input().disabled).toBe(true);
    expect(burnBtn().disabled).toBe(true);
    for (const p of BURN_PRESETS) {
      expect((screen.getByRole('button', { name: p.label }) as HTMLButtonElement).disabled).toBe(true);
    }
    release();
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
  });

  it('burns a topic successfully and calls onBurned (13.10, 14.1)', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn(failingFetch);
    const { onBurned } = setup({ fetch: fetchSpy });
    await user.type(input(), 'Lighthouses and the keepers who tended their lamps');
    await user.click(burnBtn());
    await waitFor(() => expect(onBurned).toHaveBeenCalledTimes(1));
    expect(onBurned.mock.calls[0]![0].sections.length).toBeGreaterThan(0);
    // The only request is the encyclopedia lookup, which failed here, so the offline outline was used.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]![0])).toMatch(/^\/api\/topic\?q=/);
  });

  it('shows an error with an offline control that burns a disc (13.12, 14.3)', async () => {
    const user = userEvent.setup();
    const { onBurned } = setup();
    await user.click(screen.getByRole('button', { name: 'GitHub: octocat/Hello-World' }));
    await user.click(burnBtn());
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert.textContent).toMatch(/network could not be reached/));
    expect(input().disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Burn offline from "Hello-World"' }));
    await waitFor(() => expect(onBurned).toHaveBeenCalledTimes(1));
  });

  it('lists validation-failed lines and mounts nothing (13.13, 14.4)', async () => {
    const user = userEvent.setup();
    forced.errors = [
      { path: 'sections[0].title', message: 'too long' },
      { path: 'trivia', message: 'too few' },
    ];
    const { onBurned } = setup();
    await user.type(input(), 'A topic about bells');
    await user.click(burnBtn());
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert.querySelectorAll('li').length).toBe(2));
    expect(alert.textContent).toContain('sections[0].title: too long');
    expect(alert.textContent).toContain('trivia: too few');
    expect(onBurned).not.toHaveBeenCalled();
  });

  it('Cancel during a pending fetch aborts the signal and mounts nothing (13.14)', async () => {
    const user = userEvent.setup();
    let signal: AbortSignal | undefined;
    const pending: FetchLike = (_u, init) =>
      new Promise((_res, rej) => {
        signal = init?.signal ?? undefined;
        init?.signal?.addEventListener('abort', () => rej(new DOMException('a', 'AbortError')));
      });
    const { onBurned, onClose } = setup({ fetch: pending });
    await user.click(screen.getByRole('button', { name: 'GitHub: octocat/Hello-World' }));
    await user.click(burnBtn());
    await waitFor(() => expect(signal).toBeDefined());
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(signal!.aborted).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 20));
    expect(onBurned).not.toHaveBeenCalled();
  });

  it('Escape cancels (13.14)', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab and Shift+Tab stay inside the dialog (13.16)', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>Opener</button>
        <BurnDialog onBurned={() => {}} onClose={() => {}} fetch={failingFetch} minBurnMs={0} />
      </>,
    );
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 12; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 12; i++) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('returns focus to the opener on close (13.16)', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = setup();
    expect(document.activeElement).not.toBe(opener);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('typing clears the error (13.12)', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'GitHub: octocat/Hello-World' }));
    await user.click(burnBtn());
    await waitFor(() => expect(screen.getByRole('alert').textContent).not.toBe(''));
    await user.type(input(), 'x');
    expect(screen.getByRole('alert', { hidden: true }).textContent).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the offline message and blocks URL burns when offline (14.7)', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn(failingFetch);
    setup({ online: () => false, fetch: fetchSpy });
    expect(screen.getByText('URL sources need a connection.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'GitHub: octocat/Hello-World' }));
    await user.click(burnBtn());
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('URL sources need a connection.');
    expect(screen.getByRole('button', { name: 'Burn offline from "Hello-World"' })).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('creates no audio nodes when muted, burning and clicking (16.9, 17.16)', async () => {
    const user = userEvent.setup();
    setMuted(true);
    const { onBurned } = setup();
    await user.click(screen.getByRole('button', { name: BURN_PRESETS[2]!.label }));
    await user.click(burnBtn());
    await waitFor(() => expect(onBurned).toHaveBeenCalled());
    expect(counters.created).toBe(0);
    expect(counters.started).toBe(0);
  });
});

describe('burn presets', () => {
  it('has at least 2 GitHub and 2 topic presets, each parsing to its kind (13.5)', () => {
    expect(BURN_PRESETS.filter((p) => p.kind === 'github').length).toBeGreaterThanOrEqual(2);
    expect(BURN_PRESETS.filter((p) => p.kind === 'topic').length).toBeGreaterThanOrEqual(2);
    for (const p of BURN_PRESETS) {
      const r = parseInput(p.text);
      expect(r.ok && r.kind).toBe(p.kind);
    }
  });
});
