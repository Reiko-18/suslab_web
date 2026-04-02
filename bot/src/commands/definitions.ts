import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js'

// ── /ticket ─────────────────────────────────────────────────────────────────
const ticketCommand = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('管理支援票券')
  .setDescriptionLocalizations({
    'en-US': 'Manage support tickets',
    'en-GB': 'Manage support tickets',
    ja: 'サポートチケットを管理する',
    'zh-CN': '管理支持工单',
    'zh-TW': '管理支援票券',
  })
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('建立新票券')
      .setDescriptionLocalizations({
        'en-US': 'Create a new ticket',
        'en-GB': 'Create a new ticket',
        ja: '新しいチケットを作成する',
        'zh-CN': '创建新工单',
        'zh-TW': '建立新票券',
      })
      .addStringOption((opt) =>
        opt
          .setName('title')
          .setDescription('票券標題')
          .setDescriptionLocalizations({
            'en-US': 'Ticket title',
            'en-GB': 'Ticket title',
            ja: 'チケットのタイトル',
            'zh-CN': '工单标题',
            'zh-TW': '票券標題',
          })
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('票券分類')
          .setDescriptionLocalizations({
            'en-US': 'Ticket category',
            'en-GB': 'Ticket category',
            ja: 'チケットのカテゴリ',
            'zh-CN': '工单分类',
            'zh-TW': '票券分類',
          })
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
          .setDescriptionLocalizations({
            'en-US': 'Ticket priority',
            'en-GB': 'Ticket priority',
            ja: 'チケットの優先度',
            'zh-CN': '工单优先级',
            'zh-TW': '票券優先度',
          })
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
      .setDescriptionLocalizations({
        'en-US': 'View ticket status',
        'en-GB': 'View ticket status',
        ja: 'チケットのステータスを確認する',
        'zh-CN': '查看工单状态',
        'zh-TW': '查看票券狀態',
      })
      .addStringOption((opt) =>
        opt
          .setName('ticket-id')
          .setDescription('票券 ID（留空顯示你的最近票券）')
          .setDescriptionLocalizations({
            'en-US': 'Ticket ID (leave blank to show your recent tickets)',
            'en-GB': 'Ticket ID (leave blank to show your recent tickets)',
            ja: 'チケット ID（空欄で最近のチケットを表示）',
            'zh-CN': '工单 ID（留空显示你的最近工单）',
            'zh-TW': '票券 ID（留空顯示你的最近票券）',
          })
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('reply')
      .setDescription('回覆票券')
      .setDescriptionLocalizations({
        'en-US': 'Reply to a ticket',
        'en-GB': 'Reply to a ticket',
        ja: 'チケットに返信する',
        'zh-CN': '回复工单',
        'zh-TW': '回覆票券',
      })
      .addStringOption((opt) =>
        opt
          .setName('ticket-id')
          .setDescription('票券 ID')
          .setDescriptionLocalizations({
            'en-US': 'Ticket ID',
            'en-GB': 'Ticket ID',
            ja: 'チケット ID',
            'zh-CN': '工单 ID',
            'zh-TW': '票券 ID',
          })
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('message')
          .setDescription('回覆內容')
          .setDescriptionLocalizations({
            'en-US': 'Reply content',
            'en-GB': 'Reply content',
            ja: '返信内容',
            'zh-CN': '回复内容',
            'zh-TW': '回覆內容',
          })
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('close')
      .setDescription('關閉票券')
      .setDescriptionLocalizations({
        'en-US': 'Close a ticket',
        'en-GB': 'Close a ticket',
        ja: 'チケットをクローズする',
        'zh-CN': '关闭工单',
        'zh-TW': '關閉票券',
      })
      .addStringOption((opt) =>
        opt
          .setName('ticket-id')
          .setDescription('票券 ID')
          .setDescriptionLocalizations({
            'en-US': 'Ticket ID',
            'en-GB': 'Ticket ID',
            ja: 'チケット ID',
            'zh-CN': '工单 ID',
            'zh-TW': '票券 ID',
          })
          .setRequired(true),
      ),
  )

// ── /feedback ────────────────────────────────────────────────────────────────
const feedbackCommand = new SlashCommandBuilder()
  .setName('feedback')
  .setDescription('提交或瀏覽社群意見回饋')
  .setDescriptionLocalizations({
    'en-US': 'Submit or browse community feedback',
    'en-GB': 'Submit or browse community feedback',
    ja: 'コミュニティのフィードバックを送信・閲覧する',
    'zh-CN': '提交或浏览社区反馈',
    'zh-TW': '提交或瀏覽社群意見回饋',
  })
  .addSubcommand((sub) =>
    sub
      .setName('submit')
      .setDescription('提交意見回饋')
      .setDescriptionLocalizations({
        'en-US': 'Submit feedback',
        'en-GB': 'Submit feedback',
        ja: 'フィードバックを送信する',
        'zh-CN': '提交反馈',
        'zh-TW': '提交意見回饋',
      })
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('回饋分類')
          .setDescriptionLocalizations({
            'en-US': 'Feedback category',
            'en-GB': 'Feedback category',
            ja: 'フィードバックのカテゴリ',
            'zh-CN': '反馈分类',
            'zh-TW': '回饋分類',
          })
          .setRequired(true)
          .addChoices(
            { name: '功能建議', value: 'feature' },
            { name: '活動建議', value: 'event' },
            { name: '錯誤回報', value: 'bug' },
          ),
      )
      .addStringOption((opt) =>
        opt
          .setName('title')
          .setDescription('回饋標題')
          .setDescriptionLocalizations({
            'en-US': 'Feedback title',
            'en-GB': 'Feedback title',
            ja: 'フィードバックのタイトル',
            'zh-CN': '反馈标题',
            'zh-TW': '回饋標題',
          })
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('description')
          .setDescription('詳細描述')
          .setDescriptionLocalizations({
            'en-US': 'Detailed description',
            'en-GB': 'Detailed description',
            ja: '詳細な説明',
            'zh-CN': '详细描述',
            'zh-TW': '詳細描述',
          })
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('查看回饋列表（依票數排序）')
      .setDescriptionLocalizations({
        'en-US': 'View feedback list (sorted by votes)',
        'en-GB': 'View feedback list (sorted by votes)',
        ja: 'フィードバック一覧を表示する（投票数順）',
        'zh-CN': '查看反馈列表（按票数排序）',
        'zh-TW': '查看回饋列表（依票數排序）',
      })
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('篩選分類')
          .setDescriptionLocalizations({
            'en-US': 'Filter by category',
            'en-GB': 'Filter by category',
            ja: 'カテゴリでフィルター',
            'zh-CN': '筛选分类',
            'zh-TW': '篩選分類',
          })
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
      .setDescriptionLocalizations({
        'en-US': 'Vote for feedback',
        'en-GB': 'Vote for feedback',
        ja: 'フィードバックに投票する',
        'zh-CN': '为反馈投票',
        'zh-TW': '為回饋投票',
      })
      .addStringOption((opt) =>
        opt
          .setName('feedback-id')
          .setDescription('回饋 ID')
          .setDescriptionLocalizations({
            'en-US': 'Feedback ID',
            'en-GB': 'Feedback ID',
            ja: 'フィードバック ID',
            'zh-CN': '反馈 ID',
            'zh-TW': '回饋 ID',
          })
          .setRequired(true),
      ),
  )

// ── /profile ─────────────────────────────────────────────────────────────────
const profileCommand = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('查看或編輯個人資料')
  .setDescriptionLocalizations({
    'en-US': 'View or edit your profile',
    'en-GB': 'View or edit your profile',
    ja: 'プロフィールを表示・編集する',
    'zh-CN': '查看或编辑个人资料',
    'zh-TW': '查看或編輯個人資料',
  })
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('查看個人資料')
      .setDescriptionLocalizations({
        'en-US': 'View a profile',
        'en-GB': 'View a profile',
        ja: 'プロフィールを表示する',
        'zh-CN': '查看个人资料',
        'zh-TW': '查看個人資料',
      })
      .addUserOption((opt) =>
        opt
          .setName('user')
          .setDescription('要查看的使用者（留空查看自己）')
          .setDescriptionLocalizations({
            'en-US': 'User to view (leave blank for your own)',
            'en-GB': 'User to view (leave blank for your own)',
            ja: '表示するユーザー（空欄で自分のプロフィール）',
            'zh-CN': '要查看的用户（留空查看自己）',
            'zh-TW': '要查看的使用者（留空查看自己）',
          })
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('編輯自己的個人資料')
      .setDescriptionLocalizations({
        'en-US': 'Edit your own profile',
        'en-GB': 'Edit your own profile',
        ja: '自分のプロフィールを編集する',
        'zh-CN': '编辑自己的个人资料',
        'zh-TW': '編輯自己的個人資料',
      }),
  )

// ── /event ───────────────────────────────────────────────────────────────────
const eventCommand = new SlashCommandBuilder()
  .setName('event')
  .setDescription('瀏覽與報名活動')
  .setDescriptionLocalizations({
    'en-US': 'Browse and register for events',
    'en-GB': 'Browse and register for events',
    ja: 'イベントを閲覧・登録する',
    'zh-CN': '浏览与报名活动',
    'zh-TW': '瀏覽與報名活動',
  })
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('查看即將舉辦的活動')
      .setDescriptionLocalizations({
        'en-US': 'View upcoming events',
        'en-GB': 'View upcoming events',
        ja: '近日開催予定のイベントを表示する',
        'zh-CN': '查看即将举办的活动',
        'zh-TW': '查看即將舉辦的活動',
      }),
  )
  .addSubcommand((sub) =>
    sub
      .setName('join')
      .setDescription('報名活動')
      .setDescriptionLocalizations({
        'en-US': 'Register for an event',
        'en-GB': 'Register for an event',
        ja: 'イベントに参加登録する',
        'zh-CN': '报名活动',
        'zh-TW': '報名活動',
      })
      .addStringOption((opt) =>
        opt
          .setName('event-id')
          .setDescription('活動 ID')
          .setDescriptionLocalizations({
            'en-US': 'Event ID',
            'en-GB': 'Event ID',
            ja: 'イベント ID',
            'zh-CN': '活动 ID',
            'zh-TW': '活動 ID',
          })
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('leave')
      .setDescription('取消報名活動')
      .setDescriptionLocalizations({
        'en-US': 'Cancel event registration',
        'en-GB': 'Cancel event registration',
        ja: 'イベントの参加登録をキャンセルする',
        'zh-CN': '取消报名活动',
        'zh-TW': '取消報名活動',
      })
      .addStringOption((opt) =>
        opt
          .setName('event-id')
          .setDescription('活動 ID')
          .setDescriptionLocalizations({
            'en-US': 'Event ID',
            'en-GB': 'Event ID',
            ja: 'イベント ID',
            'zh-CN': '活动 ID',
            'zh-TW': '活動 ID',
          })
          .setRequired(true),
      ),
  )

// ── /mod ─────────────────────────────────────────────────────────────────────
const modCommand = new SlashCommandBuilder()
  .setName('mod')
  .setDescription('管理員指令')
  .setDescriptionLocalizations({
    'en-US': 'Moderator commands',
    'en-GB': 'Moderator commands',
    ja: 'モデレーターコマンド',
    'zh-CN': '管理员指令',
    'zh-TW': '管理員指令',
  })
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand((sub) =>
    sub
      .setName('ticket-status')
      .setDescription('更新票券狀態')
      .setDescriptionLocalizations({
        'en-US': 'Update ticket status',
        'en-GB': 'Update ticket status',
        ja: 'チケットのステータスを更新する',
        'zh-CN': '更新工单状态',
        'zh-TW': '更新票券狀態',
      })
      .addStringOption((opt) =>
        opt
          .setName('ticket-id')
          .setDescription('票券 ID')
          .setDescriptionLocalizations({
            'en-US': 'Ticket ID',
            'en-GB': 'Ticket ID',
            ja: 'チケット ID',
            'zh-CN': '工单 ID',
            'zh-TW': '票券 ID',
          })
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setDescription('新狀態')
          .setDescriptionLocalizations({
            'en-US': 'New status',
            'en-GB': 'New status',
            ja: '新しいステータス',
            'zh-CN': '新状态',
            'zh-TW': '新狀態',
          })
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
      .setDescriptionLocalizations({
        'en-US': 'Assign a ticket to a moderator',
        'en-GB': 'Assign a ticket to a moderator',
        ja: 'チケットをモデレーターに割り当てる',
        'zh-CN': '指派工单给管理员',
        'zh-TW': '指派票券給管理員',
      })
      .addStringOption((opt) =>
        opt
          .setName('ticket-id')
          .setDescription('票券 ID')
          .setDescriptionLocalizations({
            'en-US': 'Ticket ID',
            'en-GB': 'Ticket ID',
            ja: 'チケット ID',
            'zh-CN': '工单 ID',
            'zh-TW': '票券 ID',
          })
          .setRequired(true),
      )
      .addUserOption((opt) =>
        opt
          .setName('user')
          .setDescription('指派給誰')
          .setDescriptionLocalizations({
            'en-US': 'Assign to',
            'en-GB': 'Assign to',
            ja: '割り当て先',
            'zh-CN': '指派给谁',
            'zh-TW': '指派給誰',
          })
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('feedback-review')
      .setDescription('審查回饋')
      .setDescriptionLocalizations({
        'en-US': 'Review feedback',
        'en-GB': 'Review feedback',
        ja: 'フィードバックを審査する',
        'zh-CN': '审查反馈',
        'zh-TW': '審查回饋',
      })
      .addStringOption((opt) =>
        opt
          .setName('feedback-id')
          .setDescription('回饋 ID')
          .setDescriptionLocalizations({
            'en-US': 'Feedback ID',
            'en-GB': 'Feedback ID',
            ja: 'フィードバック ID',
            'zh-CN': '反馈 ID',
            'zh-TW': '回饋 ID',
          })
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setDescription('新狀態')
          .setDescriptionLocalizations({
            'en-US': 'New status',
            'en-GB': 'New status',
            ja: '新しいステータス',
            'zh-CN': '新状态',
            'zh-TW': '新狀態',
          })
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
      .setDescriptionLocalizations({
        'en-US': 'Warn a member',
        'en-GB': 'Warn a member',
        ja: 'メンバーに警告する',
        'zh-CN': '警告成员',
        'zh-TW': '警告成員',
      })
      .addUserOption((opt) =>
        opt
          .setName('user')
          .setDescription('要警告的使用者')
          .setDescriptionLocalizations({
            'en-US': 'User to warn',
            'en-GB': 'User to warn',
            ja: '警告するユーザー',
            'zh-CN': '要警告的用户',
            'zh-TW': '要警告的使用者',
          })
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('reason')
          .setDescription('警告原因')
          .setDescriptionLocalizations({
            'en-US': 'Reason for warning',
            'en-GB': 'Reason for warning',
            ja: '警告の理由',
            'zh-CN': '警告原因',
            'zh-TW': '警告原因',
          })
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('timeout')
      .setDescription('禁言成員')
      .setDescriptionLocalizations({
        'en-US': 'Timeout a member',
        'en-GB': 'Timeout a member',
        ja: 'メンバーをタイムアウトする',
        'zh-CN': '禁言成员',
        'zh-TW': '禁言成員',
      })
      .addUserOption((opt) =>
        opt
          .setName('user')
          .setDescription('要禁言的使用者')
          .setDescriptionLocalizations({
            'en-US': 'User to timeout',
            'en-GB': 'User to timeout',
            ja: 'タイムアウトするユーザー',
            'zh-CN': '要禁言的用户',
            'zh-TW': '要禁言的使用者',
          })
          .setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('duration')
          .setDescription('禁言時間（分鐘）')
          .setDescriptionLocalizations({
            'en-US': 'Duration (minutes)',
            'en-GB': 'Duration (minutes)',
            ja: 'タイムアウト時間（分）',
            'zh-CN': '禁言时间（分钟）',
            'zh-TW': '禁言時間（分鐘）',
          })
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(40320),
      )
      .addStringOption((opt) =>
        opt
          .setName('reason')
          .setDescription('禁言原因')
          .setDescriptionLocalizations({
            'en-US': 'Reason for timeout',
            'en-GB': 'Reason for timeout',
            ja: 'タイムアウトの理由',
            'zh-CN': '禁言原因',
            'zh-TW': '禁言原因',
          })
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('kick')
      .setDescription('踢除成員')
      .setDescriptionLocalizations({
        'en-US': 'Kick a member',
        'en-GB': 'Kick a member',
        ja: 'メンバーをキックする',
        'zh-CN': '踢出成员',
        'zh-TW': '踢除成員',
      })
      .addUserOption((opt) =>
        opt
          .setName('user')
          .setDescription('要踢除的使用者')
          .setDescriptionLocalizations({
            'en-US': 'User to kick',
            'en-GB': 'User to kick',
            ja: 'キックするユーザー',
            'zh-CN': '要踢出的用户',
            'zh-TW': '要踢除的使用者',
          })
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('reason')
          .setDescription('踢除原因')
          .setDescriptionLocalizations({
            'en-US': 'Reason for kick',
            'en-GB': 'Reason for kick',
            ja: 'キックの理由',
            'zh-CN': '踢出原因',
            'zh-TW': '踢除原因',
          })
          .setRequired(false),
      ),
  )

// ── /settings ────────────────────────────────────────────────────────────────
const settingsCommand = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('管理個人偏好設定')
  .setDescriptionLocalizations({
    'en-US': 'Manage personal preferences',
    'en-GB': 'Manage personal preferences',
    ja: '個人設定を管理する',
    'zh-CN': '管理个人偏好设置',
    'zh-TW': '管理個人偏好設定',
  })
  .addSubcommand((sub) =>
    sub
      .setName('language')
      .setDescription('設定偏好語言')
      .setDescriptionLocalizations({
        'en-US': 'Set preferred language',
        'en-GB': 'Set preferred language',
        ja: '使用言語を設定する',
        'zh-CN': '设置偏好语言',
        'zh-TW': '設定偏好語言',
      })
      .addStringOption((opt) =>
        opt
          .setName('language')
          .setDescription('選擇語言')
          .setDescriptionLocalizations({
            'en-US': 'Choose language',
            'en-GB': 'Choose language',
            ja: '言語を選択する',
            'zh-CN': '选择语言',
            'zh-TW': '選擇語言',
          })
          .setRequired(true)
          .addChoices(
            { name: 'English', value: 'en' },
            { name: '日本語', value: 'ja' },
            { name: '简体中文', value: 'zh-CN' },
            { name: '繁體中文', value: 'zh-TW' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('查看目前設定')
      .setDescriptionLocalizations({
        'en-US': 'View current settings',
        'en-GB': 'View current settings',
        ja: '現在の設定を確認する',
        'zh-CN': '查看当前设置',
        'zh-TW': '查看目前設定',
      }),
  )

export const commands = [ticketCommand, feedbackCommand, profileCommand, eventCommand, modCommand, settingsCommand]
