import i18next from 'i18next'
import type { TFunction } from 'i18next'
import en from './locales/en.json'
import ja from './locales/ja.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

export const SUPPORTED_LOCALES = ['en', 'ja', 'zh-CN', 'zh-TW'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export async function initI18n(): Promise<void> {
  await i18next.init({
    resources: {
      en: { translation: en },
      ja: { translation: ja },
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhTW },
    },
    fallbackLng: 'zh-TW',
    interpolation: { escapeValue: false },
  })
}

export function getT(locale: string): TFunction {
  return i18next.getFixedT(locale)
}

export type { TFunction }
