import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js'

// ── /ticket ─────────────────────────────────────────────────────────────────
const ticketCommand = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('管理支援票券')
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('建立新票券')
      .addStringOption((opt) =>
        opt.setName('title').setDescription('票券標題').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('票券分類')
          .setRequired(false)
          .addChoices(
            { name: '一般', value: 'general' },
            { name: '錯誤回報', value: 'bug' },
            { name: '功能請求', value: 'request' },
            { name: '檢舉', value: 'report' },
          ),
      )
      .addStringOption((opt) =>
        opt
          .setName('priority')
          .setDescription('票券優先度')
          .setRequired(false)
          .addChoices(
            { name: '低', value: 'low' },
            { name: '普通', value: 'normal' },
            { name: '高', value: 'high' },
            { name: '緊急', value: 'urgent' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('status')
      .setDescription('查看票券狀態')
      .addStringOption((opt) =>
        opt.setName('ticket-id').setDescription('票券 ID（留空顯示你的最近票券）').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('reply')
      .setDescription('回覆票券')
      .addStringOption((opt) =>
        opt.setName('ticket-id').setDescription('票券 ID').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('message').setDescription('回覆內容').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('close')
      .setDescription('關閉票券')
      .addStringOption((opt) =>
        opt.setName('ticket-id').setDescription('票券 ID').setRequired(true),
      ),
  )

// ── /feedback ────────────────────────────────────────────────────────────────
const feedbackCommand = new SlashCommandBuilder()
  .setName('feedback')
  .setDescription('提交或瀏覽社群意見回饋')
  .addSubcommand((sub) =>
    sub
      .setName('submit')
      .setDescription('提交意見回饋')
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('回饋分類')
          .setRequired(true)
          .addChoices(
            { name: '功能建議', value: 'feature' },
            { name: '活動建議', value: 'event' },
            { name: '錯誤回報', value: 'bug' },
          ),
      )
      .addStringOption((opt) =>
        opt.setName('title').setDescription('回饋標題').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('description').setDescription('詳細描述').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('查看回饋列表（依票數排序）')
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('篩選分類')
          .setRequired(false)
          .addChoices(
            { name: '功能建議', value: 'feature' },
            { name: '活動建議', value: 'event' },
            { name: '錯誤回報', value: 'bug' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('vote')
      .setDescription('為回饋投票')
      .addStringOption((opt) =>
        opt.setName('feedback-id').setDescription('回饋 ID').setRequired(true),
      ),
  )

// ── /profile ─────────────────────────────────────────────────────────────────
const profileCommand = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('查看或編輯個人資料')
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('查看個人資料')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('要查看的使用者（留空查看自己）').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('edit').setDescription('編輯自己的個人資料'),
  )

// ── /event ───────────────────────────────────────────────────────────────────
const eventCommand = new SlashCommandBuilder()
  .setName('event')
  .setDescription('瀏覽與報名活動')
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('查看即將舉辦的活動'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('join')
      .setDescription('報名活動')
      .addStringOption((opt) =>
        opt.setName('event-id').setDescription('活動 ID').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('leave')
      .setDescription('取消報名活動')
      .addStringOption((opt) =>
        opt.setName('event-id').setDescription('活動 ID').setRequired(true),
      ),
  )

// ── /mod ─────────────────────────────────────────────────────────────────────
const modCommand = new SlashCommandBuilder()
  .setName('mod')
  .setDescription('管理員指令')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand((sub) =>
    sub
      .setName('ticket-status')
      .setDescription('更新票券狀態')
      .addStringOption((opt) =>
        opt.setName('ticket-id').setDescription('票券 ID').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setDescription('新狀態')
          .setRequired(true)
          .addChoices(
            { name: '開放中', value: 'open' },
            { name: '處理中', value: 'in_progress' },
            { name: '已解決', value: 'resolved' },
            { name: '已關閉', value: 'closed' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('ticket-assign')
      .setDescription('指派票券給管理員')
      .addStringOption((opt) =>
        opt.setName('ticket-id').setDescription('票券 ID').setRequired(true),
      )
      .addUserOption((opt) =>
        opt.setName('user').setDescription('指派給誰').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('feedback-review')
      .setDescription('審查回饋')
      .addStringOption((opt) =>
        opt.setName('feedback-id').setDescription('回饋 ID').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setDescription('新狀態')
          .setRequired(true)
          .addChoices(
            { name: '待審核', value: 'pending' },
            { name: '審核中', value: 'reviewing' },
            { name: '已採納', value: 'accepted' },
            { name: '已拒絕', value: 'rejected' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('warn')
      .setDescription('警告成員')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('要警告的使用者').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('警告原因').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('timeout')
      .setDescription('禁言成員')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('要禁言的使用者').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('duration')
          .setDescription('禁言時間（分鐘）')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(40320),
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('禁言原因').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('kick')
      .setDescription('踢除成員')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('要踢除的使用者').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('踢除原因').setRequired(false),
      ),
  )

// ── /settings ────────────────────────────────────────────────────────────────
const settingsCommand = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('管理個人偏好設定')
  .addSubcommand((sub) =>
    sub
      .setName('language')
      .setDescription('設定偏好語言')
      .addStringOption((opt) =>
        opt
          .setName('language')
          .setDescription('選擇語言')
          .setRequired(true)
          .addChoices(
            { name: 'English', value: 'en' },
            { name: '日本語', value: 'ja' },
            { name: '简体中文', value: 'zh-CN' },
            { name: '繁體中文', value: 'zh-TW' },
          ),
      ),
  )
  .addSubcommand((sub) => sub.setName('view').setDescription('查看目前設定'))

export const commands = [ticketCommand, feedbackCommand, profileCommand, eventCommand, modCommand, settingsCommand]
