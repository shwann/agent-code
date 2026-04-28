/**
 * agent-code 桌面端合并 sidecar 入口。
 *
 * 历史上 server / cli / IM adapters 是各自独立的进程。每个 bun-compile
 * 二进制都要带一份 ~55MB 的 bun runtime，光这一项就重复占了 100MB+。
 * 把所有运行模式合并到同一个二进制里，runtime 只保留一份；调用方通过
 * 第一个 positional 参数选择模式：
 *
 *   agent-code-sidecar server   --app-root <path> --host 127.0.0.1 --port 12345
 *   agent-code-sidecar cli      --app-root <path> [其它 CLI 参数...]
 *   agent-code-sidecar adapters --app-root <path> [--feishu] [--telegram]
 *
 * 任何模式都必须先做 process.env / process.argv 设置，再 await 进入相应的
 * 子模块树。原因：src/server/index.ts、src/entrypoints/cli.tsx、以及
 * adapters/feishu/index.ts 等顶层都会立即读 process.argv / process.env，
 * 必须在它们求值前 splice 掉 --app-root、mode、--feishu/--telegram 这些
 * launcher-only 参数。
 */

import { parseLauncherArgs, resolveSidecarInvocation } from './launcherRouting'

const rawArgs = process.argv.slice(2)
const invocation = resolveSidecarInvocation(rawArgs)
if (!invocation.mode) {
  console.error('agent-code-sidecar: missing mode argument (expected "server", "cli" or "adapters")')
  process.exit(2)
}
const mode = invocation.mode
const restArgs = invocation.restArgs

if (mode === 'adapters') {
  await runAdapters(restArgs)
} else {
  const { appRoot, args } = parseLauncherArgs(restArgs, invocation.defaultAppRoot)

  process.env.CLAUDE_APP_ROOT = appRoot
  process.env.CALLER_DIR ||= process.cwd()
  process.argv = [process.argv[0]!, process.argv[1]!, ...args]

  await import('../../preload.ts')

  if (mode === 'server') {
    const { startServer } = await import('../../src/server/index.ts')
    startServer()
  } else if (mode === 'cli') {
    await import('../../src/entrypoints/cli.tsx')
  } else {
    console.error(`agent-code-sidecar: unknown mode "${mode}" (expected "server", "cli" or "adapters")`)
    process.exit(2)
  }
}

async function runAdapters(rawArgs: string[]): Promise<void> {
  // adapters 模式的参数解析独立于 server/cli —— 这里只接受 --feishu /
  // --telegram 选择启用哪个适配器，再加可选的 --app-root（透传给
  // adapters/common/config.ts 内的 process.env 读取）。
  let appRoot: string | null = process.env.CLAUDE_APP_ROOT ?? null
  let enableFeishu = false
  let enableTelegram = false

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]
    if (arg === '--app-root') {
      appRoot = rawArgs[i + 1] ?? null
      i += 1
      continue
    }
    if (arg === '--feishu') {
      enableFeishu = true
      continue
    }
    if (arg === '--telegram') {
      enableTelegram = true
      continue
    }
    console.warn(`agent-code-sidecar adapters: ignoring unknown arg "${arg}"`)
  }

  if (!enableFeishu && !enableTelegram) {
    console.error(
      'agent-code-sidecar adapters: must enable at least one of --feishu / --telegram',
    )
    process.exit(2)
  }

  if (appRoot) {
    process.env.CLAUDE_APP_ROOT = appRoot
  }
  process.env.CALLER_DIR ||= process.cwd()

  await import('../../preload.ts')

  // 在 import adapter 之前先用同一份 loadConfig() 检查凭据。adapter 的
  // top-level 代码里已经有 if (!cred) process.exit(1)。这里提前 gate：
  // 缺凭据时保持 sidecar 存活并等待用户写入 adapters.json；凭据出现后再
  // import 对应 adapter，让 Docker / 桌面端无需重启也能连接上。
  const { getConfigPath, loadConfig } = await import('../../adapters/common/config.ts')
  const started = new Set<'feishu' | 'telegram'>()
  const waitingLogged = new Set<'feishu' | 'telegram'>()
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const maybeStartAdapters = async () => {
    const config = loadConfig()

    if (enableFeishu && !started.has('feishu')) {
      if (!config.feishu.appId || !config.feishu.appSecret) {
        if (!waitingLogged.has('feishu')) {
          console.log(
            `[agent-code-sidecar] Feishu adapter waiting for user config at ${getConfigPath()}`,
          )
          waitingLogged.add('feishu')
        }
      } else {
        console.log('[agent-code-sidecar] starting Feishu adapter')
        // 副作用 import：feishu/index.ts 顶层会自动 new WSClient + start()
        await import('../../adapters/feishu/index.ts')
        started.add('feishu')
      }
    }

    if (enableTelegram && !started.has('telegram')) {
      if (!config.telegram.botToken) {
        if (!waitingLogged.has('telegram')) {
          console.log(
            `[agent-code-sidecar] Telegram adapter waiting for user config at ${getConfigPath()}`,
          )
          waitingLogged.add('telegram')
        }
      } else {
        console.log('[agent-code-sidecar] starting Telegram adapter')
        // 副作用 import：telegram/index.ts 顶层会自动 bot.start()
        await import('../../adapters/telegram/index.ts')
        started.add('telegram')
      }
    }

    const allRequestedStarted =
      (!enableFeishu || started.has('feishu')) &&
      (!enableTelegram || started.has('telegram'))
    if (allRequestedStarted && pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  await maybeStartAdapters()

  const shouldKeepPolling =
    (enableFeishu && !started.has('feishu')) ||
    (enableTelegram && !started.has('telegram'))

  if (shouldKeepPolling) {
    pollTimer = setInterval(() => {
      void maybeStartAdapters().catch((err) => {
        console.error(
          '[agent-code-sidecar] adapter config check failed:',
          err instanceof Error ? err.message : err,
        )
      })
    }, 5000)
  }
}
