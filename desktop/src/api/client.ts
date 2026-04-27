function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, '')
}

function resolveDefaultBaseUrl() {
  // 优先检查 VITE_DESKTOP_SERVER_URL
  const envDesktopUrl =
    typeof import.meta !== 'undefined' &&
    typeof import.meta.env?.VITE_DESKTOP_SERVER_URL === 'string' &&
    import.meta.env.VITE_DESKTOP_SERVER_URL.length > 0
      ? import.meta.env.VITE_DESKTOP_SERVER_URL
      : undefined
  if (envDesktopUrl) {
    return stripTrailingSlash(envDesktopUrl)
  }

  // 然后检查 VITE_API_BASE_URL
  const envBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim()
  if (envBaseUrl) {
    return stripTrailingSlash(envBaseUrl)
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:3456'
  }

  const isTauriRuntime = '__TAURI_INTERNALS__' in window || '__TAURI__' in window
  if (isTauriRuntime) {
    return 'http://127.0.0.1:3456'
  }

  return stripTrailingSlash(window.location.origin)
}

const DEFAULT_BASE_URL = resolveDefaultBaseUrl()

let baseUrl = DEFAULT_BASE_URL

function getErrorMessage(status: number, body: unknown) {
  if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
    return body.message
  }

  if (typeof body === 'string' && body.trim().length > 0) {
    return body
  }

  return `API error ${status}`
}

export function setBaseUrl(url: string) {
  baseUrl = stripTrailingSlash(url)
}

export function getBaseUrl() {
  return baseUrl
}

export function getDefaultBaseUrl() {
  return DEFAULT_BASE_URL
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(getErrorMessage(status, body))
    this.name = 'ApiError'
  }
}

async function request<T>(method: string, path: string, body?: unknown, options?: { timeout?: number }): Promise<T> {
  const url = `${baseUrl}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const controller = new AbortController()
  const timeoutMs = options?.timeout ?? 30_000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const errorBody = await res.json().catch(() => res.text())
      throw new ApiError(res.status, errorBody)
    }

    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  } catch (err) {
    clearTimeout(timeout)
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`)
    }
    throw err
  }
}

export const api = {
  get: <T>(path: string, options?: { timeout?: number }) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: { timeout?: number }) => request<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
