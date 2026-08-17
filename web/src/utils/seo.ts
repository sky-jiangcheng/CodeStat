import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const SITE_URL = 'https://sky-jiangcheng.github.io/gitboard'
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`

interface PageMeta {
  title: string
  description?: string
  path?: string
  image?: string
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Sets document title plus canonical, Open Graph and Twitter meta tags.
 * Also updates <html lang> to match the current i18n language.
 */
export function usePageMeta({ title, description, path = '/', image = DEFAULT_IMAGE }: PageMeta) {
  const { i18n } = useTranslation()

  useEffect(() => {
    document.title = title
    const desc = description ?? i18n.t('common.loading', { defaultValue: 'GitBuddy' })
    const url = `${SITE_URL}${path}`
    setMeta('name', 'description', desc)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', desc)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', image)
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', desc)
    setMeta('name', 'twitter:image', image)
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', url)
  }, [title, description, path, image, i18n.language, i18n])

  // Keep <html lang> in sync
  useEffect(() => {
    const lang = i18n.language === 'zh-CN' ? 'zh-CN' : 'en'
    if (document.documentElement.lang !== lang) {
      document.documentElement.lang = lang
    }
  }, [i18n.language])
}
