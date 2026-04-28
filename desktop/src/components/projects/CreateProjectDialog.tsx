import { useState } from 'react'
import { projectsApi } from '../../api/projects'
import { useTranslation } from '../../i18n'
import type { ProjectRecord } from '../../types/project'

type CreateProjectDialogProps = {
  open: boolean
  onClose: () => void
  onCreated: (project: ProjectRecord) => void
  onError: (message: string) => void
}

export function CreateProjectDialog({
  open,
  onClose,
  onCreated,
  onError,
}: CreateProjectDialogProps) {
  const t = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!open) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || isSubmitting) return

    setIsSubmitting(true)
    try {
      const { project } = await projectsApi.create({
        name: trimmedName,
        description: description.trim() || undefined,
      })
      setName('')
      setDescription('')
      onCreated(project)
    } catch (error) {
      onError(error instanceof Error ? error.message : t('empty.projectCreateFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[460px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] p-5 shadow-[var(--shadow-dropdown)]"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t('empty.createProjectTitle')}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">
              {t('empty.createProjectSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            aria-label={t('common.cancel')}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
              {t('empty.projectName')}
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-brand)]"
              placeholder={t('empty.projectNamePlaceholder')}
              disabled={isSubmitting}
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
              {t('empty.projectDescription')}
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-[96px] w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-2 text-sm leading-5 text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-brand)]"
              placeholder={t('empty.projectDescriptionPlaceholder')}
              disabled={isSubmitting}
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="flex min-w-[104px] items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-btn-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-btn-primary-fg)] shadow-[var(--shadow-button-primary)] transition-all hover:brightness-105 disabled:opacity-30"
          >
            {isSubmitting ? t('empty.creatingProject') : t('empty.createProject')}
          </button>
        </div>
      </form>
    </div>
  )
}
