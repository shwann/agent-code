function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, '')
}

function resolveDefaultBaseUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
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
    super(`API error ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
    this.name = 'ApiError'
  }
}

async function request<T>(method: string, path: string, body?: unknown, options?: { timeout?: number }): Promise<T> {
  const url = `${baseUrl}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options?.timeout ?? 30_000)
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
