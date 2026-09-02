/**
 * Clipboard helpers.
 *
 * The desktop shell runs on the `wails://` origin, where the async Clipboard
 * API may be unavailable (non-secure context) or blocked by permissions. When
 * that happens we fall back to the legacy selection-based copy so that
 * user-facing "copy" actions still work instead of silently failing.
 */

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)

  try {
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

/** Copy text to the system clipboard, throwing when every strategy fails. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Permission denied or non-secure context - try the legacy path below.
    }
  }
  if (!legacyCopy(text)) {
    throw new Error('clipboard unavailable')
  }
}
