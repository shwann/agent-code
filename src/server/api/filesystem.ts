/**
 * Filesystem browser & search API — supports directory browsing and file search
 * for the DirectoryPicker component and @-triggered file search popup.
 */

import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { sessionService } from '../services/sessionService.js'

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
}

const TEXT_PREVIEW_MAX_BYTES = 1024 * 1024

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  return targetPath === rootPath || targetPath.startsWith(`${rootPath}${path.sep}`)
}

async function getAllowedFilesystemRoots(sessionId?: string): Promise<string[]> {
  const roots = [
    os.homedir(),
    '/tmp',
    process.env.AGENT_CODE_WORKSPACE_DIR,
  ]

  if (sessionId) {
    const sessionWorkDir = await sessionService.getSessionWorkDir(sessionId)
    if (sessionWorkDir) roots.push(sessionWorkDir)
  }

  return roots
    .filter((root): root is string => !!root && path.resolve(root) !== path.parse(path.resolve(root)).root)
    .map((root) => toComparableFilesystemPath(root))
}

function toComparableFilesystemPath(targetPath: string): string {
  const resolvedPath = path.resolve(targetPath)
  try {
    return fs.realpathSync(resolvedPath)
  } catch {
    return resolvedPath
  }
}

async function getAuthorizedFilesystemPath(targetPath: string, sessionId?: string): Promise<string | null> {
  const comparablePath = toComparableFilesystemPath(targetPath)
  const allowedRoots = await getAllowedFilesystemRoots(sessionId)

  if (allowedRoots.some((root) => isWithinRoot(comparablePath, root))) {
    return comparablePath
  }

  return null
}

export async function handleFilesystemRoute(pathname: string, url: URL): Promise<Response> {
  if (pathname === '/api/filesystem/browse') {
    return handleBrowse(url)
  }

  if (pathname === '/api/filesystem/file') {
    return handleServeFile(url)
  }

  if (pathname === '/api/filesystem/read') {
    return handleReadFile(url)
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
}

async function handleReadFile(url: URL): Promise<Response> {
  const filePath = url.searchParams.get('path')
  const sessionId = url.searchParams.get('sessionId') || undefined
  if (!filePath) {
    return json({ error: 'Missing path parameter' }, 400)
  }

  const resolvedPath = path.resolve(filePath)
  const authorizedPath = await getAuthorizedFilesystemPath(resolvedPath, sessionId)

  if (!authorizedPath) {
    return json({ error: 'Access denied: path outside allowed directory' }, 403)
  }

  try {
    const stat = fs.statSync(authorizedPath)
    if (!stat.isFile()) {
      return json({ error: 'Not a file' }, 400)
    }
    if (stat.size > TEXT_PREVIEW_MAX_BYTES) {
      return json({ error: 'File too large to preview', size: stat.size }, 400)
    }

    const buffer = fs.readFileSync(authorizedPath)
    if (buffer.includes(0)) {
      return json({ error: 'Binary file preview is not supported', size: stat.size }, 400)
    }

    return json({
      path: resolvedPath,
      name: path.basename(resolvedPath),
      size: stat.size,
      content: buffer.toString('utf-8'),
    })
  } catch {
    return json({ error: 'File not found' }, 404)
  }
}

async function handleServeFile(url: URL): Promise<Response> {
  const filePath = url.searchParams.get('path')
  const sessionId = url.searchParams.get('sessionId') || undefined
  if (!filePath) {
    return json({ error: 'Missing path parameter' }, 400)
  }

  const resolvedPath = path.resolve(filePath)
  const authorizedPath = await getAuthorizedFilesystemPath(resolvedPath, sessionId)

  if (!authorizedPath) {
    return json({ error: 'Access denied: path outside allowed directory' }, 403)
  }

  const ext = path.extname(resolvedPath).toLowerCase()
  const mimeType = IMAGE_MIME_TYPES[ext]

  if (!mimeType) {
    return json({ error: 'Unsupported file type' }, 400)
  }

  try {
    const stat = fs.statSync(authorizedPath)
    if (!stat.isFile()) {
      return json({ error: 'Not a file' }, 400)
    }
    // Limit to 50MB
    if (stat.size > 50 * 1024 * 1024) {
      return json({ error: 'File too large' }, 400)
    }

    const data = fs.readFileSync(authorizedPath)
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return json({ error: 'File not found' }, 404)
  }
}

async function handleBrowse(url: URL): Promise<Response> {
  const targetPath = url.searchParams.get('path') || process.env.HOME || '/'
  const sessionId = url.searchParams.get('sessionId') || undefined
  const resolvedPath = path.resolve(targetPath)
  const authorizedPath = await getAuthorizedFilesystemPath(resolvedPath, sessionId)

  if (!authorizedPath) {
    return json({ error: 'Access denied: path outside allowed directory' }, 403)
  }

  const searchQuery = url.searchParams.get('search') || ''
  const includeFiles = url.searchParams.get('includeFiles') === 'true'
  const maxResults = Math.min(parseInt(url.searchParams.get('maxResults') || '200', 10), 200)

  try {
    const stat = fs.statSync(authorizedPath)
    if (!stat.isDirectory()) {
      return json({ error: 'Not a directory', path: resolvedPath }, 400)
    }

    const entries = fs.readdirSync(authorizedPath, { withFileTypes: true })

    if (searchQuery) {
      // Search mode: filter by filename, include both dirs and files
      const query = searchQuery.toLowerCase()
      const results = entries
        .filter((e) => {
          if (e.name.startsWith('.')) return false
          if (e.isDirectory()) return e.name.toLowerCase().includes(query)
          if (!includeFiles) return false
          return e.name.toLowerCase().includes(query)
        })
        .slice(0, maxResults)
        .map((e) => ({
          name: e.name,
          path: path.join(resolvedPath, e.name),
          isDirectory: e.isDirectory(),
        }))
        .sort((a, b) => {
          // Directories first, then alphabetically
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })

      return json({
        currentPath: resolvedPath,
        parentPath: path.dirname(resolvedPath),
        entries: results,
        query: searchQuery,
      })
    }

    // Browse mode: show all directories (and optionally files)
    const filtered = entries.filter((e) => {
      if (e.name.startsWith('.')) return false
      if (e.isDirectory()) return true
      return includeFiles
    })

    const entries_list = filtered
      .map((e) => ({
        name: e.name,
        path: path.join(resolvedPath, e.name),
        isDirectory: e.isDirectory(),
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })

    return json({
      currentPath: resolvedPath,
      parentPath: path.dirname(resolvedPath),
      entries: entries_list,
    })
  } catch (err) {
    return json({ error: `Cannot read directory: ${err}`, path: resolvedPath }, 500)
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
