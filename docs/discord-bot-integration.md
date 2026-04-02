# Discord Bot 整合基礎

本次先補齊後端基礎，讓網頁端與 Discord Bot 可以共用同一套資料模型與同步佇列。

## 已完成

- 新增 `discord_guilds`，可儲存多個 Discord server 的設定。
- 新增 `discord_guild_memberships`，記錄 Supabase 使用者對應到哪些 guild。
- 在 `member_profiles` 快取 Discord 帳號資訊：
  - `discord_user_id`
  - `discord_username`
  - `discord_global_name`
  - `discord_avatar`
  - `discord_locale`
- `discord_roles`、`pending_bot_actions`、`tickets` 都補上 `guild_id`，可支援多 guild。
- 新增 `supabase/functions/_shared/discord.ts`，集中處理 Discord REST API。
- 新增 `process-discord-actions` Edge Function，可把 `pending_bot_actions` 真正送到 Discord。
- Discord OAuth scopes 已擴充為 `identify guilds guilds.members.read`。

## 目前流程

1. 使用者用 Discord OAuth 登入。
2. `manage-profile` 的 `sync-discord` 會抓取：
   - Discord 個人帳號資料
   - 使用者所在 guild 清單
   - Bot 可讀取的 guild member 詳細資料
3. 管理員從網頁執行 role / ban / kick / timeout。
4. Edge Functions 寫入 `pending_bot_actions`。
5. 由 `process-discord-actions` 讀取 queue 並呼叫 Discord API。

## 必要環境變數

請在 Supabase Edge Functions 環境設定：

- `DISCORD_BOT_TOKEN`
- `DISCORD_API_BASE_URL`
  - 可省略，預設為 `https://discord.com/api/v10`

## 部署建議

- 先執行新的 migration。
- 部署以下 Edge Functions：
  - `manage-profile`
  - `manage-roles`
  - `manage-users`
  - `process-discord-actions`
- 讓管理端在適當時機呼叫 `process-discord-actions`，或改成排程執行。

## 下一步建議

- 補 `discord-interactions` Edge Function，處理 slash commands 與 interaction 驗簽。
- 在 `discord_roles` 加入「app role 對應規則」欄位，避免只靠名稱綁定 `member/moderator/admin`。
- 將 tickets 擴充為 Discord forum/thread 同步。
- 在 admin settings UI 補多 guild 切換與 guild 級別設定。

## 安全提醒

你在對話中貼出的 Discord `bot token`、`client secret` 與其他憑證都應該立即到 Discord Developer Portal 重新產生。
這些值一旦外流，就不能再視為安全。
