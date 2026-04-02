/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import { Button, Card, Chip, Avatar, Tabs, Skeleton, Snackbar, TextField } from '../components/ui'
import { Container, Stack } from '../components/layout'
import TodoItem from '../components/TodoItem'

interface SnackState {
  severity: 'success' | 'error' | 'info' | 'warning'
  message: string
}

export default function Todos() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tab, setTab] = useState('personal')
  const [todos, setTodos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [snack, setSnack] = useState<SnackState | null>(null)

  const loadTodos = useCallback(async () => {
    try {
      setLoading(true)
      const data = await edgeFunctions.listTodos({ pageSize: 100 }) as { todos?: any[] }
      setTodos(data.todos ?? [])
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTodos() }, [loadTodos])

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    try {
      await edgeFunctions.createTodo({ title, is_public: tab === 'community' })
      setNewTitle('')
      loadTodos()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleToggle = async (id: string, completed: boolean) => {
    try {
      await edgeFunctions.updateTodo(id, { completed })
      loadTodos()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await edgeFunctions.deleteTodo(id)
      loadTodos()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleClaim = async (id: string) => {
    try {
      await edgeFunctions.claimTodo(id)
      loadTodos()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleUnclaim = async (id: string) => {
    try {
      await edgeFunctions.unclaimTodo(id)
      loadTodos()
    } catch (err: any) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const personalTodos = todos.filter((todo) => !todo.is_public && todo.user_id === user?.id)
  const communityTodos = todos.filter((todo) => todo.is_public)

  return (
    <Container maxWidth="md" css={css({ paddingTop: 32, paddingBottom: 32 })}>
      <h1 css={css({ fontSize: 28, fontWeight: 700, color: 'var(--color-on-surface)', margin: '0 0 16px' })}>{t('todos.title')}</h1>

      <Tabs
        tabs={[
          { label: t('todos.personal'), value: 'personal' },
          { label: t('todos.community'), value: 'community' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Add todo */}
      <div css={css({ display: 'flex', gap: 8, margin: '24px 0' })}>
        <TextField
          placeholder={t('todos.addPlaceholder')}
          value={newTitle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleAdd()}
          maxLength={200}
          fullWidth
        />
        <Button variant="primary" startIcon="add" onClick={handleAdd} disabled={!newTitle.trim()}>
          {t('todos.add')}
        </Button>
      </div>

      {loading ? (
        <Stack gap={8}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={48} />)}
        </Stack>
      ) : tab === 'personal' ? (
        personalTodos.length === 0 ? (
          <Card css={css({ padding: 32, textAlign: 'center' })}>
            <p css={css({ color: 'var(--color-on-surface-muted)', margin: 0 })}>{t('todos.empty')}</p>
          </Card>
        ) : (
          <div>
            {personalTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggle}
                onDelete={handleDelete}
                canDelete={true}
              />
            ))}
          </div>
        )
      ) : (
        communityTodos.length === 0 ? (
          <Card css={css({ padding: 32, textAlign: 'center' })}>
            <p css={css({ color: 'var(--color-on-surface-muted)', margin: 0 })}>{t('todos.empty')}</p>
          </Card>
        ) : (
          <Stack gap={16}>
            {communityTodos.map((todo) => {
              const isCreator: boolean = todo.user_id === user?.id
              const isAssignee: boolean = todo.assigned_to === user?.id
              const statusLabel: string = todo.completed
                ? t('todos.completed')
                : todo.assigned_to
                  ? t('todos.claimedBy', { name: todo.assignee_display_name ?? '' })
                  : t('todos.open')
              const statusColor: string | undefined = todo.completed ? 'var(--color-success)' : todo.assigned_to ? 'var(--color-warning)' : undefined

              return (
                <Card key={todo.id} css={css({ padding: 16 })}>
                  <div css={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 })}>
                    <div>
                      <p css={css({
                        fontSize: 16, fontWeight: 500, margin: 0,
                        textDecoration: todo.completed ? 'line-through' : 'none',
                        color: 'var(--color-on-surface)',
                      })}>
                        {todo.title}
                      </p>
                      <div css={css({ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 })}>
                        <Avatar src={todo.creator_avatar_url} size={20} />
                        <span css={css({ fontSize: 12, color: 'var(--color-on-surface-muted)' })}>{todo.creator_display_name}</span>
                      </div>
                    </div>
                    <div css={css({ display: 'flex', alignItems: 'center', gap: 8 })}>
                      <Chip label={statusLabel} size="small" color={statusColor} />
                      {!todo.completed && !todo.assigned_to && !isCreator && (
                        <Button size="small" variant="secondary" onClick={() => handleClaim(todo.id)}>
                          {t('todos.claim')}
                        </Button>
                      )}
                      {!todo.completed && isAssignee && (
                        <>
                          <Button size="small" variant="secondary" onClick={() => handleUnclaim(todo.id)}>
                            {t('todos.unclaim')}
                          </Button>
                          <Button size="small" variant="primary" onClick={() => handleToggle(todo.id, true)}>
                            {t('todos.completed')}
                          </Button>
                        </>
                      )}
                      {isCreator && (
                        <Button size="small" variant="ghost" onClick={() => handleDelete(todo.id)} css={css({ color: 'var(--color-error)' })}>
                          {t('todos.delete')}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </Stack>
        )
      )}

      <Snackbar
        open={!!snack}
        onClose={() => setSnack(null)}
        message={snack?.message ?? ''}
      />
    </Container>
  )
}
