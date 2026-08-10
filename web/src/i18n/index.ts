import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const detected = navigator.language.startsWith('zh') ? 'zh-CN' : 'en'
const stored = localStorage.getItem('gitbuddy-language')
const lng = stored === 'zh-CN' || stored === 'en' ? stored : detected

// Lazy-load locale files to avoid bundler issues with nested JSON paths
const loadLocale = async (code: string) => {
  try {
    const mod = await import(`../locales/${code}/common.json`)
    return mod.default
  } catch {
    return {}
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      // Pre-register with empty fallbacks; real data loaded lazily
      'zh-CN': { common: { __loaded: false } },
      en:       { common: { __loaded: false } },
    },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })

// Load the actual locale data after init
loadLocale('zh-CN').then(data => {
  if (data) i18n.addResourceBundle('zh-CN', 'common', data, true, true)
})
loadLocale('en').then(data => {
  if (data) i18n.addResourceBundle('en', 'common', data, true, true)
})

export function setLanguage(lng: string) {
  i18n.changeLanguage(lng)
  localStorage.setItem('gitbuddy-language', lng)
  document.documentElement.lang = lng === 'zh-CN' ? 'zh-CN' : 'en'
  window.dispatchEvent(new Event('gitbuddy-lang-change'))
}

export function getCurrentLanguage() {
  return i18n.language
}

export default i18n
