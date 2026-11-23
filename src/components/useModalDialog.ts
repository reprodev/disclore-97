import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog behavior: Escape calls onCancel, Tab and Shift+Tab cycle inside
 * the container, and focus returns to the previously focused element on close.
 */
export function useModalDialog(
  containerRef: RefObject<HTMLElement | null>,
  onCancel: () => void,
  active = true,
): void {
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  // A layout effect runs in the same commit that puts the dialog on screen, so the dialog never appears
  // without its Escape and Tab handling. A passive useEffect would leave a gap until after the paint, and
  // an Escape pressed in that gap (or sent by a test right after the dialog shows) would be lost.
  useLayoutEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;

    const focusables = (): HTMLElement[] => {
      const root = containerRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true',
      );
    };

    const root = containerRef.current;
    if (root && !root.contains(document.activeElement)) {
      (focusables()[0] ?? root).focus();
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      const box = containerRef.current;
      if (!box) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (!box.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [active, containerRef]);
}
