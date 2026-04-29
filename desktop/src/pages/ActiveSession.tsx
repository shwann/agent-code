import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bot, CheckCircle2, FolderOpen, FolderTree, TriangleAlert } from 'lucide-react'
import { useTabStore } from '../stores/tabStore'
import { useSessionStore } from '../stores/sessionStore'
import { useChatStore } from '../stores/chatStore'
import { useCLITaskStore } from '../stores/cliTaskStore'
import { useTeamStore } from '../stores/teamStore'
import { useTranslation } from '../i18n'
import { MessageList } from '../components/chat/MessageList'
import { ChatInput } from '../components/chat/ChatInput'
import { ComputerUsePermissionModal } from '../components/chat/ComputerUsePermissionModal'
import { TeamStatusBar } from '../components/teams/TeamStatusBar'
import { SessionTaskBar } from '../components/chat/SessionTaskBar'
import { ChatWorkspacePanel } from '../components/chat/ChatWorkspacePanel'
import type { SessionListItem } from '../types/session'

const TASK_POLL_INTERVAL_MS = 1000

export function ActiveSession() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const sessions = useSessionStore((s) => s.sessions)
  const connectToSession = useChatStore((s) => s.connectToSession)
  const sessionState = useChatStore((s) => activeTabId ? s.sessions[activeTabId] : undefined)
  const pendingComputerUsePermission = sessionState?.pendingComputerUsePermission ?? null
  const fetchSessionTasks = useCLITaskStore((s) => s.fetchSessionTasks)
  const trackedTaskSessionId = useCLITaskStore((s) => s.sessionId)
  const hasIncompleteTasks = useCLITaskStore((s) => s.tasks.some((task) => task.status !== 'completed'))
  const chatState = sessionState?.chatState ?? 'idle'
  const tokenUsage = sessionState?.tokenUsage ?? { input_tokens: 0, output_tokens: 0 }
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(false)

  const session = sessions.find((s) => s.id === activeTabId)
  const memberInfo = useTeamStore((s) => activeTabId ? s.getMemberBySessionId(activeTabId) : null)
  const activeTeam = useTeamStore((s) => s.activeTeam)
  const isMemberSession = !!memberInfo

  useEffect(() => {
    if (activeTabId && !isMemberSession) {
      connectToSession(activeTabId)
    }
  }, [activeTabId, isMemberSession, connectToSession])

  useEffect(() => {
    if (!activeTabId || isMemberSession) return

    const shouldPollTasks =
      chatState !== 'idle' ||
      (trackedTaskSessionId === activeTabId && hasIncompleteTasks)

    if (!shouldPollTasks) return

    void fetchSessionTasks(activeTabId)

    const timer = setInterval(() => {
      void fetchSessionTasks(activeTabId)
    }, TASK_POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [
    activeTabId,
    isMemberSession,
    chatState,
    trackedTaskSessionId,
    hasIncompleteTasks,
    fetchSessionTasks,
  ])

  const t = useTranslation()
  const messages = sessionState?.messages ?? []
  const streamingText = sessionState?.streamingText ?? ''
  const isEmpty = messages.length === 0 && !streamingText

  const isActive = chatState !== 'idle'
  const totalTokens = tokenUsage.input_tokens + tokenUsage.output_tokens

  const lastUpdated = useMemo(() => {
    if (!session?.modifiedAt) return ''
    const diff = Date.now() - new Date(session.modifiedAt).getTime()
    if (diff < 60000) return t('session.timeJustNow')
    if (diff < 3600000) return t('session.timeMinutes', { n: Math.floor(diff / 60000) })
    if (diff < 86400000) return t('session.timeHours', { n: Math.floor(diff / 3600000) })
    return t('session.timeDays', { n: Math.floor(diff / 86400000) })
  }, [session?.modifiedAt, t])

  if (!activeTabId) return null

  return (
    <div className="app-canvas flex-1 flex flex-col relative overflow-hidden text-[var(--color-text-primary)]">
      {isMemberSession && (
        <div className="page-header shrink-0">
          <div className="mx-auto max-w-[860px] flex items-center justify-between gap-4 px-8 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                {memberInfo?.status === 'running' && (
                  <span className="flex h-2 w-2 rounded-full bg-[var(--color-warning)] animate-pulse-dot" />
                )}
                {memberInfo?.status === 'completed' && (
                  <CheckCircle2 size={14} strokeWidth={1.4} className="text-[var(--color-success)]" />
                )}
                <Bot size={14} strokeWidth={1.35} className="text-[var(--color-text-tertiary)]" />
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {memberInfo?.role}
                </span>
                {activeTeam && (
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">
                    @ {activeTeam.name}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                {t('teams.memberSessionHint')}
              </p>
            </div>
            <button
              onClick={() => {
                if (activeTeam?.leadSessionId) {
                  useTabStore.getState().openTab(
                    activeTeam.leadSessionId,
                    t('teams.leader'),
                    'session',
                  )
                }
              }}
              disabled={!activeTeam?.leadSessionId}
              className="icon-button flex shrink-0 items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:hover:text-[var(--color-text-secondary)]"
            >
              <ArrowLeft size={14} strokeWidth={1.35} />
              {t('teams.backToLeader')}
            </button>
          </div>
        </div>
      )}

      {!isMemberSession && (
        <SessionHeader
          session={session}
          isActive={isActive}
          totalTokens={totalTokens}
          lastUpdated={lastUpdated}
          workspacePanelOpen={workspacePanelOpen}
          onToggleWorkspacePanel={() => setWorkspacePanelOpen((current) => !current)}
          t={t}
        />
      )}

      <div className="min-h-0 flex-1 flex overflow-hidden">
        <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
          {isEmpty ? (
            <div className="empty-stage relative flex flex-1 flex-col items-center justify-center p-8 pb-40">
              <div className="flex max-w-[620px] flex-col items-center text-center">
                {isMemberSession ? (
                  <>
                    <Bot size={44} strokeWidth={1.15} className="mb-4 text-[var(--color-text-tertiary)]" />
                    <p className="text-[var(--color-text-secondary)]">
                      {memberInfo?.status === 'running'
                        ? `${memberInfo.role} ${t('teams.working')}`
                        : t('teams.noMessages')}
                    </p>
                  </>
                ) : (
                  <>
                    <img src="/app-icon.png" alt="AgentCode" className="empty-hero-mark mb-7 h-20 w-20 rounded-3xl ring-1 ring-[var(--color-brand)]/20" />
                    <h1 className="mb-3 max-w-[560px] text-[34px] font-semibold leading-tight tracking-normal text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-headline)' }}>
                      {t('empty.title')}
                    </h1>
                    <p className="mx-auto max-w-lg text-sm leading-6 text-[var(--color-text-secondary)]" style={{ fontFamily: 'var(--font-body)' }}>
                      {t('empty.subtitle')}
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <MessageList />
          )}

          {!isMemberSession && <SessionTaskBar />}

          <TeamStatusBar />

          <ChatInput variant={isEmpty && !isMemberSession ? 'hero' : 'default'} />

          {!isMemberSession && activeTabId ? (
            <ComputerUsePermissionModal
              sessionId={activeTabId}
              request={pendingComputerUsePermission?.request ?? null}
            />
          ) : null}
        </div>

        {!isMemberSession && workspacePanelOpen ? (
          <ChatWorkspacePanel
            sessionId={activeTabId}
            workDir={session?.workDir ?? null}
            onClose={() => setWorkspacePanelOpen(false)}
          />
        ) : null}
      </div>
    </div>
  )
}

function SessionHeader({
  session,
  isActive,
  totalTokens,
  lastUpdated,
  workspacePanelOpen,
  onToggleWorkspacePanel,
  t,
}: {
  session: SessionListItem | undefined
  isActive: boolean
  totalTokens: number
  lastUpdated: string
  workspacePanelOpen: boolean
  onToggleWorkspacePanel: () => void
  t: ReturnType<typeof useTranslation>
}) {
  const workDirLabel = session?.workDir
    ? session.workDir.split('/').filter(Boolean).slice(-2).join('/')
    : null

  return (
    <div className="page-header shrink-0">
      <div className="mx-auto flex w-full max-w-[900px] items-center gap-4 px-8 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base font-semibold leading-tight text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-headline)' }}>
              {session?.title || t('session.untitled')}
            </h1>
            {isActive && (
              <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-[var(--color-success)]/20 bg-[var(--color-success)]/10 px-2 text-[10px] font-semibold text-[var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] animate-pulse-dot" />
                {t('session.active')}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-medium text-[var(--color-text-tertiary)]">
            {workDirLabel && (
              <span className="inline-flex max-w-[260px] items-center gap-1 truncate rounded-full border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-2 py-0.5">
                <FolderOpen size={12} strokeWidth={1.25} />
                <span className="truncate">{workDirLabel}</span>
              </span>
            )}
            {totalTokens > 0 && <span>{totalTokens.toLocaleString()} t</span>}
            {lastUpdated && <span>{t('session.lastUpdated', { time: lastUpdated })}</span>}
            {session?.messageCount !== undefined && session.messageCount > 0 && (
              <span>{t('session.messages', { count: session.messageCount })}</span>
            )}
          </div>
          {session?.workDirExists === false && (
            <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error)]/8 px-3 py-1.5 text-[11px] text-[var(--color-error)]">
              <TriangleAlert size={14} strokeWidth={1.35} />
              <span className="truncate">
                {t('session.workspaceUnavailable', { dir: session.workDir || 'directory no longer exists' })}
              </span>
            </div>
          )}
        </div>
        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          <WorkspaceToggleButton
            label={t('workspace.files')}
            active={workspacePanelOpen}
            onClick={onToggleWorkspacePanel}
          />
        </div>
      </div>
    </div>
  )
}

function WorkspaceToggleButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`icon-button flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] transition-colors ${
        active
          ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      <FolderTree size={18} strokeWidth={1.25} />
    </button>
  )
}
