import { useEffect } from 'react'

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
 * Sets the document title plus the canonical URL, Open Graph and Twitter
 * meta tags for the current page. Used to give each route an indexable,
 * shareable head (issue #21).
 */
export function usePageMeta({ title, description, path = '/', image = DEFAULT_IMAGE }: PageMeta) {
  useEffect(() => {
    document.title = title
    const desc = description ?? 'GitBuddy - Git 代码提交统计面板：自动发现本地 Git 仓库，可视化每日提交量。'
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
  }, [title, description, path, image])
}
