import { useTranslation } from 'react-i18next'
import { useState, useEffect, useCallback } from 'react'
import { listTodos, createTodo, toggleTodo, deleteTodo, reorderTodos, type Todo } from '../api/client'
import { useConfirmClick } from '../hooks/useConfirmClick'

interface Props {
  projectId: number
}

function TodoSection({ projectId }: Props) {
  const { t } = useTranslation()
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchTodos = useCallback(() => {
    listTodos(projectId).then(setTodos).finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { fetchTodos() }, [fetchTodos])

  const handleAdd = async () => {
    if (!title.trim()) return
    setAdding(true)
    try {
      await createTodo(projectId, title.trim())
      setTitle('')
      fetchTodos()
    } catch { /* ignore */ }
    finally { setAdding(false) }
  }

  const handleToggle = async (todo: Todo) => {
    try {
      await toggleTodo(todo.id)
      setTodos(prev =>
        prev.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t)
      )
    } catch { /* ignore */ }
  }


  const move = async (index: number, direction: number) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= todos.length) return
    const reordered = [...todos]
    const [item] = reordered.splice(index, 1)
    reordered.splice(newIndex, 0, item)
    setTodos(reordered)
    try {
      await reorderTodos(reordered.map(t => t.id))
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="panel-section">
        <h3>{t('todo.title')}</h3>
        <div className="skeleton skeleton-text" style={{ height: 36, marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ height: 36, marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ height: 36 }} />
      </div>
    )
  }

  return (
    <div className="panel-section">
      <h3>{t('todo.title')} ({todos.filter(x => !x.completed).length}/{todos.length})</h3>

      <div className="todo-add">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder={t('todo.addPlaceholder')}
          className="form-input"
        />
        <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={adding || !title.trim()}>
          {t('todo.add')}
        </button>
      </div>

      {todos.length === 0 ? (
        <p className="empty-hint">{t('todo.empty')}</p>
      ) : (
        <ul className="todo-list">
          {todos.map((todo, i) => (
            <li key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => handleToggle(todo)}
                className="todo-checkbox"
              />
              <span className="todo-title">{todo.title}</span>
              <div className="todo-actions">
                <button className="btn-icon" onClick={() => move(i, -1)} disabled={i === 0} title={t('todo.moveUp')}>
                  &#x25B2;
                </button>
                <button className="btn-icon" onClick={() => move(i, 1)} disabled={i === todos.length - 1} title={t('todo.moveDown')}>
                  &#x25BC;
                </button>
                <TodoDeleteButton todoId={todo.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default TodoSection

/** Two-click confirm delete button for one todo item. */
function TodoDeleteButton({ todoId }: { todoId: number }) {
  const { t } = useTranslation()
  const { armed, click } = useConfirmClick(async () => {
    try {
      await deleteTodo(todoId)
      window.dispatchEvent(new CustomEvent('gitbuddy:todos-changed'))
    } catch { /* ignore */ }
  })
  return (
    <button
      className={`btn-icon ${armed ? 'btn-delete-confirm' : 'btn-delete'}`}
      onClick={click}
      title={armed ? t('common.confirmDelete') : t('common.delete')}
    >
      {armed ? '?' : '\u2715'}
    </button>
  )
}
