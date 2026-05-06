import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const desktopRoot = path.resolve(import.meta.dir, '..')
const androidProjectDir = path.join(desktopRoot, 'src-tauri', 'gen', 'android')
const androidOutputsDir = path.join(androidProjectDir, 'app', 'build', 'outputs')
const canonicalOutputDir = path.join(desktopRoot, 'build-artifacts', 'android')
const androidConfig = path.join('src-tauri', 'tauri.android.conf.json')

const args = process.argv.slice(2)
const bundleArgs = selectBundleArgs(args)
const forwardedArgs = args.filter((arg) => arg !== '--apk' && arg !== '--aab')

if (!(await exists(androidProjectDir))) {
  throw new Error(
    [
      '[build-android] Missing Android project under desktop/src-tauri/gen/android.',
      'Run `cd desktop && bun run android:init` once on a machine with the Android SDK/NDK installed, then rerun this build.',
    ].join('\n'),
  )
}

if (!process.env.VITE_DESKTOP_SERVER_URL && !process.env.VITE_API_BASE_URL) {
  console.warn(
    '[build-android] WARN: VITE_DESKTOP_SERVER_URL is not set. The Android app will build, but it needs a reachable agent-code server URL to run usefully on a device.',
  )
}

await run(['bun', 'run', 'build'], {
  ...process.env,
  VITE_TAURI_MOBILE: '1',
})

await run(
  ['bunx', 'tauri', 'android', 'build', ...bundleArgs, '--config', androidConfig, ...forwardedArgs],
  {
    ...process.env,
    VITE_TAURI_MOBILE: '1',
  },
)

await stageArtifacts()

function selectBundleArgs(rawArgs: string[]) {
  const hasApk = rawArgs.includes('--apk')
  const hasAab = rawArgs.includes('--aab')
  if (hasApk || hasAab) {
    return [hasApk ? '--apk' : null, hasAab ? '--aab' : null].filter(Boolean) as string[]
  }
  return ['--apk']
}

async function run(command: string[], env: Record<string, string | undefined>) {
  console.log(`[build-android] ${command.join(' ')}`)
  const proc = Bun.spawn(command, {
    cwd: desktopRoot,
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`[build-android] Command failed with exit code ${exitCode}: ${command.join(' ')}`)
  }
}

async function exists(targetPath: string) {
  try {
    await readdir(targetPath)
    return true
  } catch {
    return false
  }
}

async function stageArtifacts() {
  const artifacts = await findArtifacts(androidOutputsDir)
  await rm(canonicalOutputDir, { recursive: true, force: true })
  await mkdir(canonicalOutputDir, { recursive: true })

  for (const artifact of artifacts) {
    await cp(artifact, path.join(canonicalOutputDir, path.basename(artifact)))
  }

  await writeFile(
    path.join(canonicalOutputDir, 'BUILD_INFO.txt'),
    [
      `Canonical output: ${canonicalOutputDir}`,
      `Android outputs: ${androidOutputsDir}`,
      `Artifacts copied: ${artifacts.length}`,
      `Built at: ${new Date().toISOString()}`,
      '',
    ].join('\n'),
  )

  console.log(`[build-android] Build finished. Artifacts output: ${canonicalOutputDir}`)
  if (artifacts.length === 0) {
    console.warn(`[build-android] WARN: No APK/AAB files found under ${androidOutputsDir}`)
  }
}

async function findArtifacts(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const artifacts: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      artifacts.push(...(await findArtifacts(entryPath)))
    } else if (entry.isFile() && (entry.name.endsWith('.apk') || entry.name.endsWith('.aab'))) {
      artifacts.push(entryPath)
    }
  }

  return artifacts.sort()
}
