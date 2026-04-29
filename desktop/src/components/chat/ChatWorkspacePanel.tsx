import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import {
  Braces,
  ChevronRight,
  File,
  FileCode2,
  FileImage,
  FileText,
  FolderX,
  Folder,
  FolderOpen,
  FolderTree,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Palette,
  Settings2,
  X,
} from 'lucide-react'
import { ApiError } from '../../api/client'
import { filesystemApi } from '../../api/filesystem'
import { useTranslation } from '../../i18n'
import { CodeViewer } from './CodeViewer'

type DirEntry = {
  name: string
  path: string
  isDirectory: boolean
}

type PreviewState =
  | { status: 'idle' }
  | { status: 'text'; path: string; name: string; size: number; content: string }
  | { status: 'image'; path: string; name: string }
  | { status: 'error'; path: string; name: string; message: string }

type Props = {
  sessionId: string
  workDir: string | null
  onClose: () => void
}

type ResizeSide = 'panel' | 'tree'
type FileIconKind = 'folder' | 'image' | 'code' | 'json' | 'markdown' | 'style' | 'config' | 'file'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif'])
const PANEL_WIDTH_STORAGE_KEY = 'agent-code.chatWorkspace.panelWidth'
const TREE_WIDTH_STORAGE_KEY = 'agent-code.chatWorkspace.treeWidth'
const DEFAULT_PANEL_WIDTH = 760
const DEFAULT_TREE_WIDTH = 280

export function ChatWorkspacePanel({ sessionId, workDir, onClose }: Props) {
  const t = useTranslation()
  const [entriesByDir, setEntriesByDir] = useState<Record<string, DirEntry[]>>({})
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<DirEntry | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [previewLoading, setPreviewLoading] = useState(false)
  const [panelWidth, setPanelWidth] = usePersistentNumber(PANEL_WIDTH_STORAGE_KEY, DEFAULT_PANEL_WIDTH)
  const [treeWidth, setTreeWidth] = usePersistentNumber(TREE_WIDTH_STORAGE_KEY, DEFAULT_TREE_WIDTH)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const resizeRef = useRef<{ side: ResizeSide; startX: number; startWidth: number } | null>(null)

  const loadDir = useCallback(async (dirPath: string) => {
    setLoadingDirs((prev) => new Set(prev).add(dirPath))
    setError(null)
    try {
      const result = await filesystemApi.browse(dirPath, { includeFiles: true, sessionId })
      setEntriesByDir((prev) => ({ ...prev, [dirPath]: result.entries }))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load files'))
    } finally {
      setLoadingDirs((prev) => {
        const next = new Set(prev)
        next.delete(dirPath)
        return next
      })
    }
  }, [sessionId])

  useEffect(() => {
    if (!workDir) return
    setEntriesByDir({})
    setExpandedDirs(new Set([workDir]))
    setSelectedFile(null)
    setPreview({ status: 'idle' })
    setPreviewLoading(false)
    void loadDir(workDir)
  }, [loadDir, workDir])

  useEffect(() => {
    if (!selectedFile) {
      setPreview({ status: 'idle' })
      setPreviewLoading(false)
      return
    }

    if (isImageFile(selectedFile.name)) {
      setPreviewLoading(false)
      setPreview({ status: 'image', path: selectedFile.path, name: selectedFile.name })
      return
    }

    let cancelled = false
    setPreviewLoading(true)
    void filesystemApi.readText(selectedFile.path, { sessionId })
      .then((result) => {
        if (cancelled) return
        setPreview({
          status: 'text',
          path: result.path,
          name: result.name,
          size: result.size,
          content: result.content,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setPreview({
          status: 'error',
          path: selectedFile.path,
          name: selectedFile.name,
          message: getApiErrorMessage(err, 'Failed to preview file'),
        })
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedFile, sessionId])

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const active = resizeRef.current
      if (!active) return
      const delta = active.startX - event.clientX
      if (active.side === 'panel') {
        const maxWidth = Math.max(520, Math.min(1120, window.innerWidth - 360))
        setPanelWidth(clamp(active.startWidth + delta, 520, maxWidth))
      } else {
        setTreeWidth(clamp(active.startWidth + delta, 220, 460))
      }
    }
    const handleUp = () => {
      resizeRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [setPanelWidth, setTreeWidth])

  const beginResize = (side: ResizeSide, event: ReactMouseEvent) => {
    resizeRef.current = {
      side,
      startX: event.clientX,
      startWidth: side === 'panel' ? panelWidth : treeWidth,
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const toggleDir = async (entry: DirEntry) => {
    const isExpanded = expandedDirs.has(entry.path)
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (isExpanded) next.delete(entry.path)
      else next.add(entry.path)
      return next
    })
    if (!isExpanded && !entriesByDir[entry.path]) {
      await loadDir(entry.path)
    }
  }

  if (!workDir) {
    return (
      <aside className="hidden min-h-0 w-[420px] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)] lg:flex lg:flex-col">
        <PanelHeader title={t('workspace.files')} onClose={onClose} />
        <EmptyPanel
          title={t('workspace.noWorkspace')}
          body={t('workspace.noWorkspaceBody')}
        />
      </aside>
    )
  }

  const panelContent = (
    <>
      <PanelHeader title={t('workspace.files')} onClose={onClose} />
      {error && (
        <div className="shrink-0 border-b border-[var(--color-error)]/20 bg-[var(--color-error)]/8 px-3 py-2 text-xs text-[var(--color-error)]">
          {error}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <FilePreview
          preview={preview}
          isLoading={previewLoading}
          root={workDir}
          sessionId={sessionId}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((value) => !value)}
        />
        <ResizeHandle onMouseDown={(event) => beginResize('tree', event)} />
        <FileTreePanel
          workDir={workDir}
          width={treeWidth}
          entriesByDir={entriesByDir}
          expandedDirs={expandedDirs}
          loadingDirs={loadingDirs}
          selectedPath={selectedFile?.path ?? null}
          onToggleDir={(entry) => void toggleDir(entry)}
          onSelectFile={setSelectedFile}
        />
      </div>
    </>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-dropdown)]">
        {panelContent}
      </div>
    )
  }

  return (
    <aside
      className="relative hidden min-h-0 shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)] lg:flex lg:flex-col"
      style={{ width: `${panelWidth}px` }}
    >
      <ResizeHandle onMouseDown={(event) => beginResize('panel', event)} edge="left" />
      {panelContent}
    </aside>
  )
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const t = useTranslation()
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-brand)]">
          <FolderTree size={17} strokeWidth={1.2} />
        </span>
        <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{title}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        title={t('workspace.close')}
        className="icon-button flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
      >
        <X size={16} strokeWidth={1.35} />
      </button>
    </div>
  )
}

function FileTreePanel({
  workDir,
  width,
  entriesByDir,
  expandedDirs,
  loadingDirs,
  selectedPath,
  onToggleDir,
  onSelectFile,
}: {
  workDir: string
  width: number
  entriesByDir: Record<string, DirEntry[]>
  expandedDirs: Set<string>
  loadingDirs: Set<string>
  selectedPath: string | null
  onToggleDir: (entry: DirEntry) => void
  onSelectFile: (entry: DirEntry) => void
}) {
  return (
    <div
      className="flex min-h-0 shrink-0 flex-col bg-[var(--color-surface-container-lowest)]"
      style={{ width: `${width}px` }}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3">
        <FolderOpen size={16} strokeWidth={1.25} className="shrink-0 text-[var(--color-text-tertiary)]" />
        <span className="truncate font-mono text-[11px] text-[var(--color-text-secondary)]">{workDir}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-2">
        <TreeRows
          root={workDir}
          dirPath={workDir}
          entriesByDir={entriesByDir}
          expandedDirs={expandedDirs}
          loadingDirs={loadingDirs}
          selectedPath={selectedPath}
          onToggleDir={onToggleDir}
          onSelectFile={onSelectFile}
        />
      </div>
    </div>
  )
}

function ResizeHandle({ onMouseDown, edge }: { onMouseDown: (event: ReactMouseEvent) => void; edge?: 'left' }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className={`group cursor-col-resize bg-transparent ${
        edge === 'left'
          ? 'absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2'
          : 'w-2 shrink-0'
      }`}
    >
      <div className="mx-auto h-full w-px bg-[var(--color-border)] transition-colors group-hover:bg-[var(--color-primary-container)]" />
    </div>
  )
}

function TreeRows({
  root,
  dirPath,
  entriesByDir,
  expandedDirs,
  loadingDirs,
  selectedPath,
  onToggleDir,
  onSelectFile,
  depth = 0,
}: {
  root: string
  dirPath: string
  entriesByDir: Record<string, DirEntry[]>
  expandedDirs: Set<string>
  loadingDirs: Set<string>
  selectedPath: string | null
  onToggleDir: (entry: DirEntry) => void
  onSelectFile: (entry: DirEntry) => void
  depth?: number
}) {
  const t = useTranslation()
  const entries = entriesByDir[dirPath]

  if (!entries && loadingDirs.has(dirPath)) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
        <LoaderCircle size={14} strokeWidth={1.35} className="animate-spin" />
        {t('common.loading')}
      </div>
    )
  }

  if (!entries) return null

  if (entries.length === 0 && dirPath === root) {
    return <div className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">{t('workspace.emptyDir')}</div>
  }

  return (
    <>
      {entries.map((entry) => {
        const isExpanded = expandedDirs.has(entry.path)
        const isSelected = selectedPath === entry.path
        const isLoading = loadingDirs.has(entry.path)
        const icon = fileIconFor(entry)
        return (
          <div key={entry.path}>
            <button
              type="button"
              onClick={() => entry.isDirectory ? onToggleDir(entry) : onSelectFile(entry)}
              className={`flex h-8 w-full items-center gap-2 px-2 text-left text-xs transition-colors ${
                isSelected
                  ? 'bg-[var(--color-primary-container)]/20 text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
              }`}
              style={{ paddingLeft: `${8 + depth * 14}px` }}
            >
              {entry.isDirectory ? (
                <TreeDisclosure isExpanded={isExpanded} isLoading={isLoading} />
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <FileGlyph kind={icon.kind} colorClass={icon.color} />
              <span className="min-w-0 flex-1 truncate font-mono">{entry.name}</span>
            </button>
            {entry.isDirectory && isExpanded && (
              <TreeRows
                root={root}
                dirPath={entry.path}
                entriesByDir={entriesByDir}
                expandedDirs={expandedDirs}
                loadingDirs={loadingDirs}
                selectedPath={selectedPath}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                depth={depth + 1}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

function TreeDisclosure({ isExpanded, isLoading }: { isExpanded: boolean; isLoading: boolean }) {
  if (isLoading) {
    return (
      <span className="flex w-4 shrink-0 items-center justify-center">
        <LoaderCircle size={12} strokeWidth={1.4} className="animate-spin text-[var(--color-text-tertiary)]" />
      </span>
    )
  }

  return (
    <span className="flex w-4 shrink-0 items-center justify-center text-[var(--color-text-tertiary)]">
      <ChevronRight size={12} strokeWidth={1.4} className={isExpanded ? 'rotate-90 transition-transform' : 'transition-transform'} />
    </span>
  )
}

function FileGlyph({ kind, colorClass }: { kind: FileIconKind; colorClass: string }) {
  const Icon = fileGlyphComponent(kind)
  return (
    <span className={`flex h-4 w-4 shrink-0 items-center justify-center ${colorClass}`}>
      <Icon size={15} strokeWidth={1.35} />
    </span>
  )
}

function fileGlyphComponent(kind: FileIconKind) {
  switch (kind) {
    case 'image':
      return FileImage
    case 'code':
      return FileCode2
    case 'json':
      return Braces
    case 'markdown':
      return FileText
    case 'style':
      return Palette
    case 'config':
      return Settings2
    case 'folder':
      return Folder
    default:
      return File
  }
}

function FilePreview({
  preview,
  isLoading,
  root,
  sessionId,
  isFullscreen,
  onToggleFullscreen,
}: {
  preview: PreviewState
  isLoading: boolean
  root: string
  sessionId: string
  isFullscreen: boolean
  onToggleFullscreen: () => void
}) {
  const t = useTranslation()

  if (preview.status === 'idle') {
    return (
      <div className="relative flex min-w-0 flex-1 items-center justify-center p-6 text-center">
        {isLoading && <PreviewLoadingBadge label={t('common.loading')} />}
        <div>
          <FileText size={30} strokeWidth={1.15} className="mx-auto mb-2 text-[var(--color-text-tertiary)]" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{t('workspace.previewTitle')}</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{t('workspace.previewHint')}</p>
        </div>
      </div>
    )
  }

  const path = preview.status === 'text' || preview.status === 'image' || preview.status === 'error'
    ? preview.path
    : ''
  const name = preview.status === 'text' || preview.status === 'image' || preview.status === 'error'
    ? preview.name
    : ''

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-[var(--color-surface)]">
      {isLoading && <PreviewLoadingBadge label={t('common.loading')} />}
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-[var(--color-text-primary)]">{name}</div>
          <div className="truncate font-mono text-[10px] text-[var(--color-text-tertiary)]">{relativePath(root, path)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {preview.status === 'text' && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">{formatBytes(preview.size)}</span>
          )}
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? t('workspace.restorePreview') : t('workspace.expandPreview')}
            className="icon-button flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          >
            {isFullscreen ? <Minimize2 size={15} strokeWidth={1.25} /> : <Maximize2 size={15} strokeWidth={1.25} />}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {preview.status === 'text' && (
          <CodeViewer
            code={preview.content}
            language={languageForFile(preview.name)}
            maxLines={isFullscreen ? 5000 : 1200}
            showLineNumbers
            fill
          />
        )}
        {preview.status === 'image' && (
          <div className="flex h-full min-h-[240px] items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-3">
            <img
              src={filesystemApi.fileUrl(preview.path, { sessionId })}
              alt={preview.name}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
        {preview.status === 'error' && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-6 text-center">
            <FileText size={28} strokeWidth={1.15} className="mx-auto mb-2 text-[var(--color-text-tertiary)]" />
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{t('workspace.previewUnavailable')}</p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{preview.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function PreviewLoadingBadge({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-2 py-1 text-[10px] text-[var(--color-text-tertiary)] shadow-sm backdrop-blur">
      <span className="h-3 w-3 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-text-tertiary)]" />
      {label}
    </div>
  )
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <FolderX size={32} strokeWidth={1.15} className="mx-auto mb-3 text-[var(--color-text-tertiary)]" />
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">{body}</p>
      </div>
    </div>
  )
}

function usePersistentNumber(key: string, fallback: number): [number, (value: number) => void] {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return fallback
    const stored = Number(window.localStorage.getItem(key))
    return Number.isFinite(stored) && stored > 0 ? stored : fallback
  })

  const updateValue = useCallback((next: number) => {
    setValue(next)
    try {
      window.localStorage.setItem(key, String(next))
    } catch {
      // Ignore storage failures.
    }
  }, [key])

  return [value, updateValue]
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (
      typeof error.body === 'object' &&
      error.body !== null &&
      'error' in error.body &&
      typeof error.body.error === 'string'
    ) {
      return error.body.error
    }
  }

  return error instanceof Error ? error.message : fallback
}

function isImageFile(name: string) {
  return IMAGE_EXTENSIONS.has(extensionForFile(name))
}

function extensionForFile(name: string) {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function fileIconFor(entry: DirEntry) {
  if (entry.isDirectory) {
    return {
      kind: 'folder' as const,
      color: 'text-[var(--color-brand)]',
    }
  }

  if (isImageFile(entry.name)) {
    return { kind: 'image' as const, color: 'text-emerald-600' }
  }

  const ext = extensionForFile(entry.name)
  if (['.ts', '.tsx', '.js', '.jsx', '.rs', '.go', '.py', '.sh'].includes(ext)) {
    return { kind: 'code' as const, color: 'text-sky-600' }
  }
  if (ext === '.json') {
    return { kind: 'json' as const, color: 'text-amber-600' }
  }
  if (['.md', '.mdx'].includes(ext)) {
    return { kind: 'markdown' as const, color: 'text-violet-600' }
  }
  if (['.css', '.scss', '.less'].includes(ext)) {
    return { kind: 'style' as const, color: 'text-pink-600' }
  }
  if (['.lock', '.toml', '.yaml', '.yml', '.env'].includes(ext) || entry.name.startsWith('.')) {
    return { kind: 'config' as const, color: 'text-slate-600' }
  }

  return { kind: 'file' as const, color: 'text-[var(--color-text-tertiary)]' }
}

function languageForFile(name: string) {
  const ext = extensionForFile(name)
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.json': 'json',
    '.css': 'css',
    '.html': 'html',
    '.md': 'markdown',
    '.rs': 'rust',
    '.go': 'go',
    '.py': 'python',
    '.sh': 'bash',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.toml': 'toml',
    '.xml': 'xml',
  }
  return map[ext] ?? 'text'
}

function relativePath(root: string, filePath: string) {
  return filePath.startsWith(`${root}/`) ? filePath.slice(root.length + 1) : filePath
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
