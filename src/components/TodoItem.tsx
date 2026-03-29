import { useTranslation } from 'react-i18next'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Checkbox from '@mui/material/Checkbox'
import DeleteIcon from '@mui/icons-material/Delete'

interface Todo {
  id: string
  title: string
  completed: boolean
}

interface TodoItemProps {
  todo: Todo
  onToggle: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
  canDelete?: boolean
}

export default function TodoItem({ todo, onToggle, onDelete, canDelete }: TodoItemProps) {
  const { t } = useTranslation()

  return (
    <ListItem
      secondaryAction={
        canDelete && (
          <IconButton edge="end" aria-label={t('todos.delete')} onClick={() => onDelete(todo.id)} size="small">
            <DeleteIcon fontSize="small" />
          </IconButton>
        )
      }
      disablePadding
      sx={{ pl: 1 }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>
        <Checkbox
          edge="start"
          checked={todo.completed}
          onChange={() => onToggle(todo.id, !todo.completed)}
          size="small"
        />
      </ListItemIcon>
      <ListItemText
        primary={todo.title}
        sx={{
          textDecoration: todo.completed ? 'line-through' : 'none',
          color: todo.completed ? 'text.disabled' : 'text.primary',
        }}
      />
    </ListItem>
  )
}
