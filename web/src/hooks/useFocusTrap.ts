import { useEffect, type RefObject } from 'react'

// useFocusTrap confines keyboard focus within a container while active. When
// `active` is true, Tab/Shift+Tab cycle through the container's focusable
// elements instead of escaping to the background page. On activation the
// first focusable element receives focus; on deactivation the previously
// focused element (outside the trap) regains focus.
//
// This makes modal dialogs like the command palette accessible to keyboard
// and screen-reader users (WCAG 2.1 SC 2.4.3 / 2.1.2).
export function useFocusTrap<T extends HTMLElement>(
  containerRef: RefObject<T>,
  active: boolean
): void {
  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    // Remember the element that had focus before the trap opened so we can
    // restore it when the trap closes.
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Move focus into the container immediately.
    const focusables = getFocusableElements(container)
    if (focusables.length > 0) {
      focusables[0].focus()
    } else {
      // No focusable child: focus the container itself so keyboard events
      // still land somewhere predictable.
      container.focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const els = getFocusableElements(container)
      if (els.length === 0) {
        e.preventDefault()
        return
      }
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last.
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // Tab: if on last element, wrap to first.
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      // Restore focus to the trigger element when the trap closes.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [active, containerRef])
}

// getFocusableElements returns all visible, enabled, focusable descendants.
function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(el => {
    if (el.getAttribute('aria-hidden') === 'true') return false
    // OffsetParent is null for display:none / visibility:hidden elements.
    return el.offsetParent !== null || el === document.activeElement
  })
}
