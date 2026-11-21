// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/audio/audio', () => ({
  playClick: vi.fn(),
}));

import { playClick } from '../../src/audio/audio';
import { Window } from '../../src/components/Window';
import { BevelButton } from '../../src/components/BevelButton';
import { MenuBar } from '../../src/components/MenuBar';
import { Tooltip } from '../../src/components/Tooltip';

beforeEach(() => {
  vi.mocked(playClick).mockClear();
});
afterEach(cleanup);

describe('Window / TitleBar (Req 9.3, 9.13)', () => {
  it('exposes a dialog named by its title and calls onClose from the close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Window title="Disclore 97" onClose={onClose}>
        <p>content</p>
      </Window>,
    );
    expect(screen.getByRole('dialog', { name: 'Disclore 97' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close button is keyboard operable', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Window title="T" onClose={onClose} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('BevelButton (Req 9.5, 9.6, 9.7)', () => {
  it('shows pressed state while the pointer is down and releases on pointer up', async () => {
    const user = userEvent.setup();
    render(<BevelButton>Go</BevelButton>);
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn.getAttribute('data-pressed')).toBe('false');
    await user.pointer({ keys: '[MouseLeft>]', target: btn });
    expect(btn.getAttribute('data-pressed')).toBe('true');
    await user.pointer({ keys: '[/MouseLeft]', target: btn });
    expect(btn.getAttribute('data-pressed')).toBe('false');
  });

  it('requests a click sound and calls onClick on activation', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<BevelButton onClick={onClick}>Go</BevelButton>);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(playClick).toHaveBeenCalledTimes(1);
  });

  it('is keyboard operable', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<BevelButton onClick={onClick}>Go</BevelButton>);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(playClick).toHaveBeenCalledTimes(1);
  });

  it('ignores activation and never shows pressed while disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <BevelButton disabled onClick={onClick}>
        Go
      </BevelButton>,
    );
    const btn = screen.getByRole('button', { name: 'Go' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await user.click(btn);
    btn.focus();
    await user.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
    expect(playClick).not.toHaveBeenCalled();
    expect(btn.getAttribute('data-pressed')).toBe('false');
  });
});

describe('MenuBar (Req 9.9, 9.10, 9.13)', () => {
  const setup = () => {
    const onNew = vi.fn();
    const onQuit = vi.fn();
    render(
      <MenuBar
        menus={[
          {
            label: 'File',
            items: [
              { label: 'New', onSelect: onNew },
              { label: 'Quit', onSelect: onQuit },
            ],
          },
          { label: 'Help', items: [{ label: 'About', onSelect: vi.fn() }] },
        ]}
      />,
    );
    return { onNew, onQuit, user: userEvent.setup() };
  };

  it('renders a menubar with named top-level menus, closed initially', () => {
    setup();
    expect(screen.getByRole('menubar')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'File' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('invokes the item callback and closes the menu when an item is clicked', async () => {
    const { onNew, user } = setup();
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(screen.getByRole('menu', { name: 'File' })).toBeTruthy();
    await user.click(screen.getByRole('menuitem', { name: 'New' }));
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens with the keyboard, selects with Enter, and closes the menu', async () => {
    const { onQuit, user } = setup();
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', { name: 'File' })).toBeTruthy();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onQuit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('moves between items with ArrowUp/ArrowDown and wraps', async () => {
    const { onNew, onQuit, user } = setup();
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    const newItem = screen.getByRole('menuitem', { name: 'New' });
    const quitItem = screen.getByRole('menuitem', { name: 'Quit' });
    expect(document.activeElement).toBe(newItem);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(quitItem);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(newItem);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(quitItem);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(newItem);
    expect(onNew).not.toHaveBeenCalled();
    expect(onQuit).not.toHaveBeenCalled();
  });

  it('switches menus with ArrowLeft/ArrowRight', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menu', { name: 'Help' })).toBeTruthy();
    expect(screen.queryByRole('menu', { name: 'File' })).toBeNull();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menu', { name: 'File' })).toBeTruthy();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('menu', { name: 'Help' })).toBeTruthy();
  });

  it('activates the focused item with Space', async () => {
    const { onQuit, user } = setup();
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.keyboard('{ArrowDown}');
    await user.keyboard(' ');
    expect(onQuit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape without invoking callbacks and returns focus to the top item', async () => {
    const { onNew, onQuit, user } = setup();
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onNew).not.toHaveBeenCalled();
    expect(onQuit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'File' }));
  });
});

describe('Tooltip (Req 9.11, 9.12, 9.13)', () => {
  const setup = () => {
    render(
      <Tooltip text="Helpful hint">
        <button type="button">Target</button>
      </Tooltip>,
    );
    const tip = document.querySelector('[role="tooltip"]') as HTMLElement;
    return { tip, user: userEvent.setup() };
  };

  it('is hidden by default and described by the tooltip text', () => {
    const { tip } = setup();
    expect(tip.hidden).toBe(true);
    expect(tip.textContent).toBe('Helpful hint');
    expect(screen.getByRole('button', { name: 'Target' }).closest('[aria-describedby]')?.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('shows on pointer hover and hides on pointer leave', async () => {
    const { tip, user } = setup();
    await user.hover(screen.getByRole('button', { name: 'Target' }));
    expect(tip.hidden).toBe(false);
    expect(screen.getByRole('tooltip').textContent).toBe('Helpful hint');
    await user.unhover(screen.getByRole('button', { name: 'Target' }));
    expect(tip.hidden).toBe(true);
  });

  it('shows its text synchronously on pointerenter without timers', () => {
    const { tip } = setup();
    const wrap = document.querySelector('.tooltip-wrap') as HTMLElement;
    act(() => {
      fireEvent.pointerEnter(wrap);
    });
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toBe('Helpful hint');
  });

  it('shows on keyboard focus and hides on blur', async () => {
    const { tip, user } = setup();
    await user.tab();
    expect(tip.hidden).toBe(false);
    await user.tab();
    expect(tip.hidden).toBe(true);
  });
});
