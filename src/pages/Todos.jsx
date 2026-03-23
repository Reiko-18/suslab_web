import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { edgeFunctions } from '../services/edgeFunctions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import TodoItem from '../components/TodoItem'

export default function Todos() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tab, setTab] = useState(0)
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [snack, setSnack] = useState(null)

  const loadTodos = useCallback(async () => {
    try {
      setLoading(true)
      const data = await edgeFunctions.listTodos({ pageSize: 100 })
      setTodos(data.todos ?? [])
    } catch (err) {
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
      await edgeFunctions.createTodo({ title, is_public: tab === 1 })
      setNewTitle('')
      loadTodos()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleToggle = async (id, completed) => {
    try {
      await edgeFunctions.updateTodo(id, { completed })
      loadTodos()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleDelete = async (id) => {
    try {
      await edgeFunctions.deleteTodo(id)
      loadTodos()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleClaim = async (id) => {
    try {
      await edgeFunctions.claimTodo(id)
      loadTodos()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const handleUnclaim = async (id) => {
    try {
      await edgeFunctions.unclaimTodo(id)
      loadTodos()
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
    }
  }

  const personalTodos = todos.filter((t) => !t.is_public && t.user_id === user?.id)
  const communityTodos = todos.filter((t) => t.is_public)

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>{t('todos.title')}</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('todos.personal')} />
        <Tab label={t('todos.community')} />
      </Tabs>

      {/* Add todo */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <TextField
          size="small"
          fullWidth
          placeholder={t('todos.addPlaceholder')}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          inputProps={{ maxLength: 200 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd} disabled={!newTitle.trim()}>
          {t('todos.add')}
        </Button>
      </Box>

      {loading ? (
        <Stack spacing={1}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={48} />)}
        </Stack>
      ) : tab === 0 ? (
        /* Personal tab */
        personalTodos.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">{t('todos.empty')}</Typography>
          </Card>
        ) : (
          <List>
            {personalTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggle}
                onDelete={handleDelete}
                canDelete={true}
              />
            ))}
          </List>
        )
      ) : (
        /* Community tab */
        communityTodos.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">{t('todos.empty')}</Typography>
          </Card>
        ) : (
          <Stack spacing={2}>
            {communityTodos.map((todo) => {
              const isCreator = todo.user_id === user?.id
              const isAssignee = todo.assigned_to === user?.id
              const statusLabel = todo.completed
                ? t('todos.completed')
                : todo.assigned_to
                  ? t('todos.claimedBy', { name: todo.assignee_display_name ?? '' })
                  : t('todos.open')
              const statusColor = todo.completed ? 'success' : todo.assigned_to ? 'warning' : 'default'

              return (
                <Card key={todo.id}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
                          {todo.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <Avatar src={todo.creator_avatar_url} sx={{ width: 20, height: 20 }} />
                          <Typography variant="caption" color="text.secondary">{todo.creator_display_name}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={statusLabel} size="small" color={statusColor} />
                        {!todo.completed && !todo.assigned_to && !isCreator && (
                          <Button size="small" variant="outlined" onClick={() => handleClaim(todo.id)}>
                            {t('todos.claim')}
                          </Button>
                        )}
                        {!todo.completed && isAssignee && (
                          <>
                            <Button size="small" variant="outlined" onClick={() => handleUnclaim(todo.id)}>
                              {t('todos.unclaim')}
                            </Button>
                            <Button size="small" variant="contained" onClick={() => handleToggle(todo.id, true)}>
                              {t('todos.completed')}
                            </Button>
                          </>
                        )}
                        {isCreator && (
                          <Button size="small" color="error" onClick={() => handleDelete(todo.id)}>
                            {t('todos.delete')}
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
        )
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        {snack && <Alert severity={snack.severity} onClose={() => setSnack(null)}>{snack.message}</Alert>}
      </Snackbar>
    </Container>
  )
}
