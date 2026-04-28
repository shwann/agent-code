import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Sidebar } from './Sidebar'
import { ContentRouter } from './ContentRouter'
import { ToastContainer } from '../shared/Toast'
import { UpdateChecker } from '../shared/UpdateChecker'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUIStore, type SettingsTab } from '../../stores/uiStore'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { initializeDesktopServerUrl } from '../../lib/desktopRuntime'
import { ApiError, getServerAuthToken, setServerAuthToken } from '../../api/client'
import { TabBar } from './TabBar'
import { StartupErrorView } from './StartupErrorView'
import { useTabStore, SETTINGS_TAB_ID } from '../../stores/tabStore'
import { useChatStore } from '../../stores/chatStore'
import { useTranslation } from '../../i18n'
import { Button } from '../shared/Button'

function isServerAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return true
  const message = error instanceof Error ? error.message : String(error)
  return /Missing Authorization header|Invalid auth token|Unauthorized/i.test(message)
}

export function AppShell() {
  const fetchSettings = useSettingsStore((s) => s.fetchAll)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const [ready, setReady] = useState(false)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [authRequired, setAuthRequired] = useState(false)
  const [authTokenInput, setAuthTokenInput] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const t = useTranslation()

  const bootstrap = useCallback(async () => {
    try {
      setStartupError(null)
      await initializeDesktopServerUrl()
      await fetchSettings()

      // Restore tabs from localStorage
      await useTabStore.getState().restoreTabs()
      const { activeTabId: activeId, tabs } = useTabStore.getState()
      const activeTab = tabs.find((tab) => tab.sessionId === activeId)
      if (activeId && activeTab?.type === 'session') {
        useChatStore.getState().connectToSession(activeId)
      }
      setAuthRequired(false)
      setAuthError(null)
      setReady(true)
    } catch (error) {
      if (isServerAuthError(error)) {
        const hadAuthToken = Boolean(getServerAuthToken())
        setServerAuthToken(null)
        setAuthTokenInput('')
        setAuthRequired(true)
        setAuthError(hadAuthToken ? (error instanceof Error ? error.message : String(error)) : null)
        setReady(false)
        setStartupError(null)
        return
      }

      setStartupError(error instanceof Error ? error.message : String(error))
      setAuthRequired(false)
      setReady(false)
    }
  }, [fetchSettings])

  useEffect(() => {
    let cancelled = false

    void bootstrap().catch((error) => {
      if (!cancelled) {
        setStartupError(error instanceof Error ? error.message : String(error))
        setReady(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [fetchSettings])

  // Listen for macOS native menu navigation events (About / Settings)
  useEffect(() => {
    let unlisten: (() => void) | undefined
    import(/* @vite-ignore */ '@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<string>('native-menu-navigate', (event) => {
          const target = event.payload as SettingsTab | 'settings'
          if (target === 'about') {
            useUIStore.getState().setPendingSettingsTab('about')
          }
          useTabStore.getState().openTab(SETTINGS_TAB_ID, 'Settings', 'settings')
        }),
      )
      .then((fn) => { unlisten = fn })
      .catch(() => {})
    return () => { unlisten?.() }
  }, [])

  useKeyboardShortcuts()

  if (startupError) {
    return <StartupErrorView error={startupError} />
  }

  if (authRequired) {
    const handleSubmit = async (event: FormEvent) => {
      event.preventDefault()
      const token = authTokenInput.trim()
      if (!token) {
        setAuthError(t('app.authTokenRequired'))
        return
      }

      setAuthSubmitting(true)
      setAuthError(null)
      setServerAuthToken(token)
      try {
        await bootstrap()
      } finally {
        setAuthSubmitting(false)
      }
    }

    return (
      <div className="page-shell flex h-screen items-center justify-center px-6">
        <form
          onSubmit={handleSubmit}
          className="premium-card w-full max-w-sm rounded-[18px] p-6"
        >
          <div className="mb-5 flex items-start gap-3">
            <span className="material-symbols-outlined mt-0.5 rounded-xl bg-[var(--color-primary-fixed)] p-2 text-[20px] text-[var(--color-brand)]">lock</span>
            <div>
              <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t('app.authRequiredTitle')}
              </h1>
              <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
                {t('app.authRequiredHint')}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">
                {t('app.authSessionHint')}
              </p>
            </div>
          </div>

          <label className="mb-2 block text-xs font-medium text-[var(--color-text-secondary)]" htmlFor="server-auth-token">
            {t('app.authTokenLabel')}
          </label>
          <input
            id="server-auth-token"
            type="password"
            autoFocus
            value={authTokenInput}
            onChange={(event) => setAuthTokenInput(event.target.value)}
            placeholder={t('app.authTokenPlaceholder')}
            className="control-field h-10 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-[background-color,border-color,box-shadow] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)] focus:shadow-[var(--shadow-focus-ring)]"
          />

          {authError ? (
            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-error)]/20 bg-[var(--color-error)]/5 px-3 py-2 text-xs text-[var(--color-error)]">
              {authError}
            </div>
          ) : null}

          <Button type="submit" className="mt-5 w-full" loading={authSubmitting}>
            {t('app.authLogin')}
          </Button>
        </form>
      </div>
    )
  }

  if (!ready) {
    return (
      <StartupLoadingView
        title={t('app.launching')}
        detail={t('app.launchingDetail')}
      />
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--color-background)]">
      <div
        data-testid="sidebar-shell"
        data-state={sidebarOpen ? 'open' : 'closed'}
        className="sidebar-shell"
      >
        <Sidebar />
      </div>
      <main
        id="content-area"
        data-sidebar-state={sidebarOpen ? 'open' : 'closed'}
        className="app-canvas min-w-0 flex-1 flex flex-col overflow-hidden"
      >
        <TabBar />
        <ContentRouter />
      </main>
      <ToastContainer />
      <UpdateChecker />
    </div>
  )
}

function StartupLoadingView({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="startup-loader-screen">
      <div className="startup-loader" role="status" aria-live="polite">
        <div className="startup-loader-mark" aria-hidden="true">
          <img src="/app-icon.png" alt="" className="startup-loader-logo" />
        </div>

        <div className="startup-loader-copy">
          <div className="startup-loader-title-row">
            <span className="startup-loader-title">{title}</span>
            <span className="startup-loader-dot" />
            <span className="startup-loader-dot startup-loader-dot--delay-1" />
            <span className="startup-loader-dot startup-loader-dot--delay-2" />
          </div>
          <div className="startup-loader-detail">{detail}</div>
        </div>
      </div>
    </div>
  )
}
