import { Client, TextChannel, ThreadChannel } from 'discord.js'
import { supabase } from '../services/supabase.js'

// ─── 型別定義 ────────────────────────────────────────────────────────────────

interface PendingBotAction {
  id: string
  action_type: string
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message: string | null
  server_id: string
  created_by: string | null
  created_at: string
  processed_at: string | null
}

// ─── 狀態更新工具 ────────────────────────────────────────────────────────────

async function markProcessing(actionId: string): Promise<void> {
  const { error } = await supabase
    .from('pending_bot_actions')
    .update({ status: 'processing' })
    .eq('id', actionId)

  if (error) {
    console.error(`[actionQueue] 更新狀態 processing 失敗 (${actionId}):`, error)
  }
}

async function markCompleted(actionId: string): Promise<void> {
  const { error } = await supabase
    .from('pending_bot_actions')
    .update({ status: 'completed', processed_at: new Date().toISOString() })
    .eq('id', actionId)

  if (error) {
    console.error(`[actionQueue] 更新狀態 completed 失敗 (${actionId}):`, error)
  }
}

async function markFailed(actionId: string, errorMessage: string): Promise<void> {
  const { error } = await supabase
    .from('pending_bot_actions')
    .update({
      status: 'failed',
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    })
    .eq('id', actionId)

  if (error) {
    console.error(`[actionQueue] 更新狀態 failed 失敗 (${actionId}):`, error)
  }
}

// ─── 取得 Discord Guild ───────────────────────────────────────────────────────

async function resolveGuild(client: Client, serverId: string) {
  // 先從 servers 資料表取得 discord_guild_id
  const { data, error } = await supabase
    .from('servers')
    .select('discord_guild_id')
    .eq('id', serverId)
    .single()

  if (error || !data?.discord_guild_id) {
    throw new Error(`找不到 server_id=${serverId} 對應的 Discord guild`)
  }

  const guild = client.guilds.cache.get(data.discord_guild_id as string)
  if (!guild) {
    throw new Error(`Bot 不在 guild=${data.discord_guild_id} 中`)
  }

  return guild
}

// ─── 動作執行器 ───────────────────────────────────────────────────────────────

async function executeAction(client: Client, action: PendingBotAction): Promise<void> {
  const { action_type, payload, server_id } = action

  switch (action_type) {
    case 'ban_user': {
      const guild = await resolveGuild(client, server_id)
      const userId = payload.user_id as string
      const reason = (payload.reason as string | undefined) ?? '由管理後台執行'
      await guild.members.ban(userId, { reason })
      console.log(`[actionQueue] ban_user 完成: userId=${userId}`)
      break
    }

    case 'unban_user': {
      const guild = await resolveGuild(client, server_id)
      const userId = payload.user_id as string
      await guild.members.unban(userId)
      console.log(`[actionQueue] unban_user 完成: userId=${userId}`)
      break
    }

    case 'kick_user': {
      const guild = await resolveGuild(client, server_id)
      const userId = payload.user_id as string
      const reason = (payload.reason as string | undefined) ?? '由管理後台執行'
      const member = await guild.members.fetch(userId)
      await member.kick(reason)
      console.log(`[actionQueue] kick_user 完成: userId=${userId}`)
      break
    }

    case 'timeout_user': {
      const guild = await resolveGuild(client, server_id)
      const userId = payload.user_id as string
      const durationMinutes = payload.duration_minutes as number
      const reason = (payload.reason as string | undefined) ?? '由管理後台執行'
      const member = await guild.members.fetch(userId)
      await member.timeout(durationMinutes * 60 * 1000, reason)
      console.log(`[actionQueue] timeout_user 完成: userId=${userId}, duration=${durationMinutes}m`)
      break
    }

    case 'sync_role': {
      const guild = await resolveGuild(client, server_id)
      const userId = payload.user_id as string
      const roleId = payload.role_id as string
      const roleAction = payload.action as 'add' | 'remove'
      const member = await guild.members.fetch(userId)

      if (roleAction === 'add') {
        await member.roles.add(roleId)
        console.log(`[actionQueue] sync_role add 完成: userId=${userId}, roleId=${roleId}`)
      } else if (roleAction === 'remove') {
        await member.roles.remove(roleId)
        console.log(`[actionQueue] sync_role remove 完成: userId=${userId}, roleId=${roleId}`)
      } else {
        throw new Error(`sync_role: 未知的 action="${roleAction}"`)
      }
      break
    }

    case 'send_message': {
      const channelId = payload.channel_id as string
      const content = payload.content as string | undefined
      const embeds = payload.embeds as object[] | undefined
      const channel = await client.channels.fetch(channelId)

      if (!channel || !(channel instanceof TextChannel)) {
        throw new Error(`send_message: channelId=${channelId} 不是文字頻道`)
      }

      await channel.send({ content, embeds: embeds as never })
      console.log(`[actionQueue] send_message 完成: channelId=${channelId}`)
      break
    }

    case 'update_thread': {
      const threadId = payload.thread_id as string
      const content = payload.content as string
      const thread = await client.channels.fetch(threadId)

      if (!thread || !(thread instanceof ThreadChannel)) {
        throw new Error(`update_thread: threadId=${threadId} 不是討論串`)
      }

      await thread.send(content)
      console.log(`[actionQueue] update_thread 完成: threadId=${threadId}`)
      break
    }

    default:
      throw new Error(`未知的 action_type: ${action_type}`)
  }
}

// ─── 處理單一動作 ─────────────────────────────────────────────────────────────

async function processAction(client: Client, action: PendingBotAction): Promise<void> {
  console.log(`[actionQueue] 開始處理動作: id=${action.id}, type=${action.action_type}`)
  await markProcessing(action.id)

  try {
    await executeAction(client, action)
    await markCompleted(action.id)
    console.log(`[actionQueue] 動作完成: id=${action.id}, type=${action.action_type}`)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[actionQueue] 動作失敗: id=${action.id}, type=${action.action_type}`, err)
    await markFailed(action.id, errorMessage)
  }
}

// ─── 補處理積壓中的 pending 動作 ──────────────────────────────────────────────

async function processBacklog(client: Client): Promise<void> {
  console.log('[actionQueue] 開始補處理積壓動作...')

  const { data, error } = await supabase
    .from('pending_bot_actions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[actionQueue] 查詢積壓動作失敗:', error)
    return
  }

  if (!data || data.length === 0) {
    console.log('[actionQueue] 無積壓動作')
    return
  }

  console.log(`[actionQueue] 發現 ${data.length} 筆積壓動作，開始逐一處理...`)

  for (const action of data as PendingBotAction[]) {
    await processAction(client, action)
  }

  console.log('[actionQueue] 積壓動作處理完成')
}

// ─── 訂閱 Realtime 新增事件 ───────────────────────────────────────────────────

function subscribeToNewActions(client: Client): void {
  supabase
    .channel('bot-actions')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pending_bot_actions' },
      (payload) => {
        const action = payload.new as PendingBotAction
        console.log(`[actionQueue] 收到新動作: id=${action.id}, type=${action.action_type}`)
        // 非同步處理，不阻塞事件監聽
        processAction(client, action).catch((err) => {
          console.error(`[actionQueue] 處理 Realtime 動作時發生未捕獲錯誤 (${action.id}):`, err)
        })
      },
    )
    .subscribe((status) => {
      console.log(`[actionQueue] Realtime 訂閱狀態: ${status}`)
    })
}

// ─── 對外接口 ─────────────────────────────────────────────────────────────────

/**
 * 啟動 action queue worker：
 * 1. 補處理啟動前積壓的 pending 動作
 * 2. 訂閱 Supabase Realtime，即時處理新增動作
 */
export function startActionQueueWorker(client: Client): void {
  console.log('[actionQueue] 啟動 action queue worker...')

  // 補處理積壓（非同步，不阻塞啟動）
  processBacklog(client).catch((err) => {
    console.error('[actionQueue] 補處理積壓動作時發生錯誤:', err)
  })

  // 訂閱即時新增事件
  subscribeToNewActions(client)

  console.log('[actionQueue] Action queue worker 已啟動')
}
