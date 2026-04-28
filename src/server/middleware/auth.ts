/**
 * Authentication middleware
 *
 * 默认优先使用 SERVER_AUTH_TOKEN 做服务端鉴权。
 * 未设置时，回退到 ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN，
 * 兼容本地桌面应用场景和反向代理注入 Bearer Token 的部署方式。
 */

function getExpectedToken(): string | undefined {
  return (
    process.env.SERVER_AUTH_TOKEN ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN
  )
}

export function validateAuth(req: Request, url?: URL): { valid: boolean; error?: string } {
  const authHeader = req.headers.get('Authorization')
  const queryToken = url?.searchParams.get('authToken')?.trim()

  if (!authHeader && !queryToken) {
    return { valid: false, error: 'Missing Authorization header' }
  }

  let token = queryToken
  if (authHeader) {
    const [scheme, headerToken] = authHeader.split(' ')

    if (scheme !== 'Bearer' || !headerToken) {
      return { valid: false, error: 'Invalid Authorization format. Use: Bearer <token>' }
    }
    token = headerToken
  }

  const expectedToken = getExpectedToken()
  if (!expectedToken) {
    return {
      valid: false,
      error: 'Server auth token not configured (set SERVER_AUTH_TOKEN or API credentials)',
    }
  }

  if (token !== expectedToken) {
    return { valid: false, error: 'Invalid auth token' }
  }

  return { valid: true }
}

/**
 * Helper to check auth and return 401 if invalid
 */
export function requireAuth(req: Request, url?: URL): Response | null {
  const { valid, error } = validateAuth(req, url)
  if (!valid) {
    return Response.json({ error: 'Unauthorized', message: error }, { status: 401 })
  }
  return null
}
