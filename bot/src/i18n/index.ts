import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import i18next from 'i18next'
import type { TFunction } from 'i18next'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadLocale(filename: string): Record<string, string> {
  const filepath = join(__dirname, 'locales', filename)
  return JSON.parse(readFileSync(filepath, 'utf-8'))
}

export const SUPPORTED_LOCALES = ['en', 'ja', 'zh-CN', 'zh-TW'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export async function initI18n(): Promise<void> {
  const en = loadLocale('en.json')
  const ja = loadLocale('ja.json')
  const zhCN = loadLocale('zh-CN.json')
  const zhTW = loadLocale('zh-TW.json')

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
