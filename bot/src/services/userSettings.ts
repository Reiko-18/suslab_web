import { supabase } from './supabase.js'
import { resolveSupabaseUserId } from './discord.js'
import { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n/index.js'

// In-memory cache: discordUserId -> { locale, expiresAt }
const cache = new Map<string, { locale: string; expiresAt: number }>()
const TTL = 10 * 60 * 1000 // 10 minutes

/**
 * 解析使用者偏好語言。
 * 優先順序：資料庫設定 → Discord 互動語言 → 預設 zh-TW
 */
export async function getUserLocale(
  discordUserId: string,
  interactionLocale?: string,
): Promise<string> {
  // 1. 檢查快取
  const cached = cache.get(discordUserId)
  if (cached && cached.expiresAt > Date.now()) return cached.locale

  // 2. 從資料庫查詢
  try {
    const supabaseUserId = await resolveSupabaseUserId(discordUserId)
    if (supabaseUserId) {
      const { data } = await supabase
        .from('member_profiles')
        .select('settings')
        .eq('user_id', supabaseUserId)
        .single()

      const lang = (data?.settings as Record<string, unknown>)?.language as string | undefined
      if (lang && (SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
        cache.set(discordUserId, { locale: lang, expiresAt: Date.now() + TTL })
        return lang
      }
    }
  } catch {
    // 資料庫錯誤 — 退回 Discord locale
  }

  // 3. Discord locale 退回
  const mapped = mapDiscordLocale(interactionLocale)
  if (mapped) {
    cache.set(discordUserId, { locale: mapped, expiresAt: Date.now() + TTL })
    return mapped
  }

  // 4. 預設值
  return 'zh-TW'
}

/**
 * 設定使用者偏好語言。將新語言合併寫入 settings JSONB 欄位。
 */
export async function setUserLocale(
  supabaseUserId: string,
  discordUserId: string,
  locale: SupportedLocale,
): Promise<void> {
  // 讀取現有 settings，合併後寫回
  const { data: existing } = await supabase
    .from('member_profiles')
    .select('settings')
    .eq('user_id', supabaseUserId)
    .single()

  const currentSettings = (existing?.settings as Record<string, unknown>) ?? {}
  const merged = { ...currentSettings, language: locale }

  await supabase
    .from('member_profiles')
    .update({ settings: merged })
    .eq('user_id', supabaseUserId)

  // 立即更新快取
  cache.set(discordUserId, { locale, expiresAt: Date.now() + TTL })
}

/**
 * 將 Discord locale 代碼對應到本系統支援的語言。
 * Discord 傳入格式如：en-US、en-GB、ja、zh-TW、zh-CN 等。
 */
function mapDiscordLocale(discordLocale?: string): string | null {
  if (!discordLocale) return null
  const mapping: Record<string, string> = {
    'en-US': 'en',
    'en-GB': 'en',
    'ja': 'ja',
    'zh-TW': 'zh-TW',
    'zh-CN': 'zh-CN',
  }
  return mapping[discordLocale] ?? null
}
