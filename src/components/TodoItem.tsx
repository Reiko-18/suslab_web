/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { Checkbox, Icon, Button } from './ui'

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
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
      `}
    >
      <Checkbox
        checked={todo.completed}
        onChange={() => onToggle(todo.id, !todo.completed)}
      />
      <span
        css={css`
          flex: 1;
          font-size: 14px;
          text-decoration: ${todo.completed ? 'line-through' : 'none'};
          color: ${todo.completed ? 'var(--color-on-surface-dim)' : 'var(--color-on-surface)'};
        `}
      >
        {todo.title}
      </span>
      {canDelete && (
        <Button
          variant="icon"
          aria-label={t('todos.delete')}
          onClick={() => onDelete(todo.id)}
        >
          <Icon name="delete" size={18} />
        </Button>
      )}
    </div>
  )
}
