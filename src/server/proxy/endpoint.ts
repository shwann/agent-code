export type OpenaiEndpointKind = 'chat_completions' | 'responses'

export function buildOpenaiEndpoint(
  baseUrl: string,
  kind: OpenaiEndpointKind,
): string {
  const suffix = kind === 'chat_completions' ? 'chat/completions' : 'responses'
  const trimmed = baseUrl.replace(/\/+$/, '')

  try {
    const url = new URL(trimmed)
    const path = url.pathname.replace(/\/+$/, '')
    if (path.endsWith('/v1') || path.endsWith('/api/v3')) {
      url.pathname = `${path}/${suffix}`
    } else {
      url.pathname = `${path}/v1/${suffix}`
    }
    return url.toString()
  } catch {
    return `${trimmed}/v1/${suffix}`
  }
}
