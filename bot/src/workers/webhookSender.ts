import { supabase } from '../services/supabase.js'

// ─── 型別定義 ────────────────────────────────────────────────────────────────

export interface WebhookEmbed {
  title: string
  description?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string }
  timestamp?: string
}

interface WebhookPayload {
  embeds: WebhookEmbed[]
}

interface ServerSettings {
  notification_webhook_url?: string | null
  notify_new_ticket?: boolean
  notify_ticket_status_change?: boolean
  notify_new_feedback?: boolean
  notify_mod_action?: boolean
}

// ─── 預設顏色 ─────────────────────────────────────────────────────────────────

const COLOR_DEFAULT = 0x7c9070
const COLOR_MOD_ACTION = 0xff6b6b
const COLOR_INFO = 0x5b8ed6
const COLOR_WARNING = 0xf0a500

// ─── 取得 Webhook URL ─────────────────────────────────────────────────────────

/**
 * 從 servers.settings 取得通知 webhook URL
 * 若未設定或為 'not_configured'，回傳 null
 */
export async function getServerWebhookUrl(serverId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('servers')
      .select('settings')
      .eq('id', serverId)
      .single()

    if (error) throw error

    const settings = data?.settings as ServerSettings | null
    const url = settings?.notification_webhook_url

    if (!url || url === 'not_configured' || url.trim() === '') {
      return null
    }

    return url
  } catch (err) {
    console.error(`[webhookSender] 取得 webhook URL 失敗 (serverId=${serverId}):`, err)
    return null
  }
}

/**
 * 從 servers.settings 取得完整設定物件
 */
async function getServerSettings(serverId: string): Promise<ServerSettings> {
  try {
    const { data, error } = await supabase
      .from('servers')
      .select('settings')
      .eq('id', serverId)
      .single()

    if (error) throw error
    return (data?.settings as ServerSettings) ?? {}
  } catch (err) {
    console.error(`[webhookSender] 取得伺服器設定失敗 (serverId=${serverId}):`, err)
    return {}
  }
}

// ─── 傳送 Webhook ─────────────────────────────────────────────────────────────

/**
 * 透過 Discord Webhook URL 傳送 embed 通知
 * 預設 embed 顏色為 0x7C9070（SusLab 主色調）
 */
export async function sendWebhookNotification(
  serverId: string,
  embed: WebhookEmbed,
): Promise<void> {
  const webhookUrl = await getServerWebhookUrl(serverId)
  if (!webhookUrl) {
    console.log(`[webhookSender] serverId=${serverId} 未設定 webhook，略過通知`)
    return
  }

  const finalEmbed: WebhookEmbed = {
    color: COLOR_DEFAULT,
    ...embed,
  }

  const payload: WebhookPayload = { embeds: [finalEmbed] }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP ${response.status}: ${text}`)
    }

    console.log(
      `[webhookSender] 通知傳送成功: serverId=${serverId}, title="${finalEmbed.title}"`,
    )
  } catch (err) {
    console.error(`[webhookSender] 傳送 webhook 失敗 (serverId=${serverId}):`, err)
  }
}

// ─── 具體通知函式 ─────────────────────────────────────────────────────────────

/**
 * 新票券通知（依 settings.notify_new_ticket 開關）
 */
export async function notifyNewTicket(
  serverId: string,
  params: {
    title: string
    category: string
    priority: string
    author_name: string
  },
): Promise<void> {
  const settings = await getServerSettings(serverId)

  if (settings.notify_new_ticket === false) {
    console.log(`[webhookSender] notify_new_ticket 已關閉，略過 serverId=${serverId}`)
    return
  }

  const priorityLabel: Record<string, string> = {
    low: '🟢 低',
    medium: '🟡 中',
    high: '🔴 高',
    urgent: '🚨 緊急',
  }

  await sendWebhookNotification(serverId, {
    title: '🎫 新票券建立',
    color: COLOR_INFO,
    fields: [
      { name: '標題', value: params.title, inline: false },
      { name: '類別', value: params.category, inline: true },
      { name: '優先級', value: priorityLabel[params.priority] ?? params.priority, inline: true },
      { name: '提交者', value: params.author_name, inline: true },
    ],
    timestamp: new Date().toISOString(),
  })
}

/**
 * 票券狀態變更通知
 */
export async function notifyTicketStatusChange(
  serverId: string,
  params: {
    title: string
    status: string
    changed_by: string
  },
): Promise<void> {
  const settings = await getServerSettings(serverId)

  if (settings.notify_ticket_status_change === false) {
    console.log(`[webhookSender] notify_ticket_status_change 已關閉，略過 serverId=${serverId}`)
    return
  }

  const statusLabel: Record<string, string> = {
    open: '📭 待處理',
    in_progress: '🔧 處理中',
    resolved: '✅ 已解決',
    closed: '🔒 已關閉',
  }

  await sendWebhookNotification(serverId, {
    title: '📋 票券狀態更新',
    color: COLOR_WARNING,
    fields: [
      { name: '票券', value: params.title, inline: false },
      {
        name: '新狀態',
        value: statusLabel[params.status] ?? params.status,
        inline: true,
      },
      { name: '操作者', value: params.changed_by, inline: true },
    ],
    timestamp: new Date().toISOString(),
  })
}

/**
 * 新回饋通知（依 settings.notify_new_feedback 開關）
 */
export async function notifyNewFeedback(
  serverId: string,
  params: {
    title: string
    category: string
    author_name: string
  },
): Promise<void> {
  const settings = await getServerSettings(serverId)

  if (settings.notify_new_feedback === false) {
    console.log(`[webhookSender] notify_new_feedback 已關閉，略過 serverId=${serverId}`)
    return
  }

  await sendWebhookNotification(serverId, {
    title: '💬 新回饋提交',
    color: COLOR_DEFAULT,
    fields: [
      { name: '標題', value: params.title, inline: false },
      { name: '類別', value: params.category, inline: true },
      { name: '提交者', value: params.author_name, inline: true },
    ],
    timestamp: new Date().toISOString(),
  })
}

/**
 * 管理動作通知（使用紅色 0xFF6B6B，依 settings.notify_mod_action 開關）
 */
export async function notifyModAction(
  serverId: string,
  params: {
    type: string
    target_name: string
    actor_name: string
    reason?: string
  },
): Promise<void> {
  const settings = await getServerSettings(serverId)

  if (settings.notify_mod_action === false) {
    console.log(`[webhookSender] notify_mod_action 已關閉，略過 serverId=${serverId}`)
    return
  }

  const actionLabel: Record<string, string> = {
    ban_user: '🔨 封禁',
    unban_user: '✅ 解除封禁',
    kick_user: '👢 踢出',
    timeout_user: '⏱️ 禁言',
    warn_user: '⚠️ 警告',
  }

  const fields = [
    { name: '動作', value: actionLabel[params.type] ?? params.type, inline: true },
    { name: '對象', value: params.target_name, inline: true },
    { name: '執行者', value: params.actor_name, inline: true },
  ]

  if (params.reason) {
    fields.push({ name: '原因', value: params.reason, inline: false })
  }

  await sendWebhookNotification(serverId, {
    title: '🛡️ 管理動作紀錄',
    color: COLOR_MOD_ACTION,
    fields,
    timestamp: new Date().toISOString(),
  })
}
