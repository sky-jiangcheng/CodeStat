import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// A shortcut maps a key combination to an action. The `key` is the
// KeyboardEvent.key value (lowercased); modifiers are matched exactly.
interface Shortcut {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  action: (navigate: (path: string) => void) => void
  // When true, the handler calls preventDefault regardless of target.
  // Defaults to false so typing in inputs is not intercepted.
  preventDefaultAlways?: boolean
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

function matches(s: Shortcut, e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase()
  if (s.key !== key) return false
  const wantCtrl = s.ctrl ?? false
  const wantMeta = s.meta ?? false
  const wantShift = s.shift ?? false
  const wantAlt = s.alt ?? false
  if (e.shiftKey !== wantShift) return false
  if (e.altKey !== wantAlt) return false
  // ctrl/meta: on Mac, ctrl=Ctrl, meta=Cmd; on others, both mean Ctrl.
  if (isMac) {
    if (e.metaKey !== wantMeta) return false
    if (e.ctrlKey !== wantCtrl) return false
  } else {
    const modPressed = e.ctrlKey || e.metaKey
    const modWanted = wantCtrl || wantMeta
    if (modPressed !== modWanted) return false
  }
  return true
}

// useGlobalShortcuts registers app-wide keyboard shortcuts. Cmd/Ctrl+K (the
// command palette) is handled by the caller via the onTogglePalette callback
// so the palette state stays in App. Navigation shortcuts use react-router's
// navigate. Shortcuts are ignored while typing in input/textarea/select
// elements unless the shortcut sets preventDefaultAlways.
export function useGlobalShortcuts(
  onTogglePalette: () => void,
  shortcuts?: Shortcut[]
): void {
  const navigate = useNavigate()

  useEffect(() => {
    const builtIn: Shortcut[] = [
      {
        key: 'k',
        meta: true,
        ctrl: true, // matched on non-Mac as Ctrl
        action: () => onTogglePalette(),
        preventDefaultAlways: true,
      },
      {
        key: 'g',
        meta: true,
        ctrl: true,
        action: (nav) => nav('/'),
        preventDefaultAlways: true,
      },
      {
        key: 'n',
        meta: true,
        ctrl: true,
        action: (nav) => nav('/knowledge'),
        preventDefaultAlways: true,
      },
      {
        key: ',',
        meta: true,
        ctrl: true,
        action: (nav) => nav('/settings'),
        preventDefaultAlways: true,
      },
      ...(shortcuts ?? []),
    ]

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable

      for (const s of builtIn) {
        if (!matches(s, e)) continue
        // Allow the shortcut only if it's a global one (preventDefaultAlways)
        // or the user is not currently typing in a field.
        if (isTyping && !s.preventDefaultAlways) continue
        e.preventDefault()
        s.action(navigate)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, onTogglePalette, shortcuts])
}
