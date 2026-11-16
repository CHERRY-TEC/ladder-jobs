import { createContext, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Phase 9 — language selector architecture: English / Telugu / Hindi.
 *
 * - The selector is real: `lang` lives in context, persisted to localStorage.
 * - `t(key, vars)` resolves a string from the dictionary for the active language,
 *   falling back to English (the source language) when a key has no translation
 *   for that language yet — nothing is ever displayed as a translation that does
 *   not exist.
 * - `isTranslated(lang, key)` tells the UI whether the resolved string actually
 *   came from a dictionary for that language, so any translated surface can mark
 *   its content honestly ("translated") instead of assuming it.
 */
export const LANG_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'te', label: 'తెలుగు' },
  { id: 'hi', label: 'हिन्दी' },
]

export const DEFAULT_LANG = 'en'

const STRINGS = {
  en: {
    'notifications.title': 'Notifications',
    'notifications.empty': 'No notifications yet — application updates will land here.',
    'notifications.stage': 'Application stage updated',
    'notifications.markRead': 'Mark read',
    'notifications.new': 'New',
    'notifications.read': 'Read',
    'notifications.unreadCount': '{count} unread',
    'notifications.browseJobs': 'Browse jobs',
    'notifications.loading': 'Loading…',
    'notifications.loadError': 'Could not load notifications',
    'language.translated': 'Translated',
    'language.fallback': 'Showing English (translation pending)',
  },
  te: {
    'notifications.title': 'నోటిఫికేషన్లు',
    'notifications.empty': 'ఇంకా నోటిఫికేషన్లు లేవు — మీ దరఖాస్తు అప్‌డేట్‌లు ఇక్కడ కనిపిస్తాయి.',
    'notifications.stage': 'దరఖాస్తు దశ నవీకరించబడింది',
    'notifications.markRead': 'చదివినట్లుగా గుర్తించు',
    'notifications.new': 'కొత్తది',
    'notifications.read': 'చదివింది',
    'notifications.unreadCount': '{count} చదవనివి',
    'notifications.browseJobs': 'ఉద్యోగాలు చూడండి',
    'notifications.loading': 'లోడ్ అవుతోంది…',
    'notifications.loadError': 'నోటిఫికేషన్లు లోడ్ కాలేదు',
    'language.translated': 'అనువదించబడింది',
    'language.fallback': 'ఇంగ్లీష్ చూపిస్తున్నాం (అనువాదం పెండింగ్)',
  },
  hi: {
    'notifications.title': 'सूचनाएँ',
    'notifications.empty': 'अभी कोई सूचना नहीं — आवेदन के अपडेट यहाँ दिखेंगे।',
    'notifications.stage': 'आवेदन चरण अपडेट हुआ',
    'notifications.markRead': 'पढ़ा हुआ चिह्नित करें',
    'notifications.new': 'नया',
    'notifications.read': 'पढ़ा हुआ',
    'notifications.unreadCount': '{count} अपठित',
    'notifications.browseJobs': 'नौकरियाँ देखें',
    'notifications.loading': 'लोड हो रहा है…',
    'notifications.loadError': 'सूचनाएँ लोड नहीं हो सकीं',
    'language.translated': 'अनुवादित',
    'language.fallback': 'अंग्रेज़ी दिखा रहे हैं (अनुवाद लंबित)',
  },
}

const LanguageContext = createContext({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key, vars) => key,
  isTranslated: (key) => false,
})

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('ladder_lang') : null
    if (saved && LANG_OPTIONS.some((l) => l.id === saved)) setLangState(saved)
  }, [])

  const setLang = (next) => {
    const id = typeof next === 'string' ? next : DEFAULT_LANG
    setLangState(id)
    try {
      window.localStorage.setItem('ladder_lang', id)
    } catch {
      /* private mode — session-only preference */
    }
  }

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key, vars) => {
        const dict = STRINGS[lang] ?? STRINGS.en
        let text = dict?.[key] ?? STRINGS.en[key] ?? key
        if (vars) {
          for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v))
        }
        return text
      },
      // true only when the active (non-English) language has its own translation
      isTranslated: (key) => lang !== DEFAULT_LANG && Boolean(STRINGS[lang]?.[key]),
      isFallback: (key) => lang !== DEFAULT_LANG && !STRINGS[lang]?.[key] && Boolean(STRINGS.en[key]),
    }),
    [lang],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
