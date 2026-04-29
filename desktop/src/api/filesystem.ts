import { api, getBaseUrl, withServerAuthQuery } from './client'

type DirEntry = {
  name: string
  path: string
  isDirectory: boolean
}

type BrowseResult = {
  currentPath: string
  parentPath: string
  entries: DirEntry[]
  query?: string
}

type FileReadResult = {
  path: string
  name: string
  size: number
  content: string
}

export const filesystemApi = {
  browse(path?: string, options?: { includeFiles?: boolean; sessionId?: string }) {
    const q = new URLSearchParams()
    if (path) q.set('path', path)
    if (options?.includeFiles) q.set('includeFiles', 'true')
    if (options?.sessionId) q.set('sessionId', options.sessionId)
    const qs = q.toString()
    return api.get<BrowseResult>(`/api/filesystem/browse${qs ? `?${qs}` : ''}`)
  },

  search(query: string, cwd?: string, options?: { sessionId?: string }) {
    const q = new URLSearchParams({ search: query, maxResults: '200' })
    if (cwd) q.set('path', cwd)
    if (options?.sessionId) q.set('sessionId', options.sessionId)
    return api.get<BrowseResult>(`/api/filesystem/browse?${q}`)
  },

  readText(path: string, options?: { sessionId?: string }) {
    const q = new URLSearchParams({ path })
    if (options?.sessionId) q.set('sessionId', options.sessionId)
    return api.get<FileReadResult>(`/api/filesystem/read?${q}`)
  },

  fileUrl(path: string, options?: { sessionId?: string }) {
    const q = new URLSearchParams({ path })
    if (options?.sessionId) q.set('sessionId', options.sessionId)
    return withServerAuthQuery(`${getBaseUrl()}/api/filesystem/file?${q}`)
  },
}
