import { useEffect, useState } from 'react'
import { useTaskStore } from '../stores/taskStore'
import { useUIStore } from '../stores/uiStore'
import { useTranslation } from '../i18n'
import { Button } from '../components/shared/Button'
import { TaskList } from '../components/tasks/TaskList'
import { TaskEmptyState } from '../components/tasks/TaskEmptyState'
import { NewTaskModal } from '../components/tasks/NewTaskModal'

export function ScheduledTasks() {
  const { tasks, fetchTasks, isLoading } = useTaskStore()
  const { activeModal, openModal, closeModal } = useUIStore()
  const t = useTranslation()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    fetchTasks().then(() => setInitialized(true))
  }, [fetchTasks])

  return (
    <div className="page-shell flex-1 overflow-y-auto">
      <div className="page-content px-10 py-8">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-headline)' }}>{t('scheduledPage.title')}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {(() => {
                const parts = t('scheduledPage.subtitle').split('{code}')
                return <>{parts[0]}<code className="px-1 py-0.5 rounded bg-[var(--color-surface-container)] text-xs font-[var(--font-mono)]">/schedule</code>{parts[1]}</>
              })()}
            </p>
          </div>
          <Button onClick={() => openModal('new-task')}>{t('tasks.newTask')}</Button>
        </div>

        {/* Desktop-online notice */}
        <div className="soft-notice mb-6 flex items-center gap-2.5 rounded-[var(--radius-lg)] px-3.5 py-2.5">
          <span className="material-symbols-outlined text-[18px] text-[var(--color-warning)]">schedule</span>
          <span className="text-xs text-[var(--color-text-secondary)]">
            {t('scheduledPage.desktopNotice')}
          </span>
        </div>

        {/* Content */}
        {!initialized && isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
          </div>
        ) : tasks.length === 0 ? (
          <TaskEmptyState onCreateTask={() => openModal('new-task')} />
        ) : (
          <TaskList tasks={tasks} />
        )}
      </div>

      {/* New Task Modal */}
      {activeModal === 'new-task' && (
        <NewTaskModal
          open
          onClose={closeModal}
        />
      )}
    </div>
  )
}
