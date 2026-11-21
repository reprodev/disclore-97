// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/App';
import type { DiscManifest } from '../../src/model/manifest';

const disc: DiscManifest = {
  disc_id: 'disc1',
  title: 'Test Disc',
  tagline: 'A tagline',
  sections: [{ section_id: 's1', title: 'Alpha', paragraphs: ['Alpha text'] }],
  diagrams: [],
  trivia: [],
  dungeons: [],
};

// Passing `sources` keeps the App off localStorage.
const sources = [disc];

afterEach(() => cleanup());

describe('Burn dialog entry points (Req 13.2, 13.3, 13.4, 17.16)', () => {
  it('the Home card opens the Burn dialog', async () => {
    const user = userEvent.setup();
    render(<App sources={sources} />);
    expect(screen.queryByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Burn New CD-R Disc/ }));
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
  });

  it('the File menu item inside an open disc opens the Burn dialog', async () => {
    const user = userEvent.setup();
    render(<App sources={sources} />);
    await user.click(screen.getByText('Test Disc'));
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Burn New Disc...' }));
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
  });

  it('the Load Disc dialog button closes the Load Disc dialog, then opens the Burn dialog', async () => {
    const user = userEvent.setup();
    render(<App sources={sources} />);
    await user.click(screen.getByText('Test Disc'));
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Load Disc...' }));
    expect(screen.getByRole('dialog', { name: 'Load Disc — Expansion Packs' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Burn New Disc...' }));
    expect(screen.queryByRole('dialog', { name: 'Load Disc — Expansion Packs' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Burn New CD-R Disc...' })).toBeTruthy();
  });
});
