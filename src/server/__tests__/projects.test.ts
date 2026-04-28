import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { handleProjectsApi } from '../api/projects.js'
import { ProjectService } from '../services/projectService.js'

let tmpDir: string

async function setupTmpDirs(): Promise<void> {
  tmpDir = path.join(os.tmpdir(), `agent-code-projects-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  process.env.CLAUDE_CONFIG_DIR = path.join(tmpDir, '.claude')
  process.env.AGENT_CODE_WORKSPACE_DIR = path.join(tmpDir, 'workspace')
  process.env.AGENT_CODE_PROJECTS_FILE = path.join(tmpDir, '.claude', 'agent-code-projects.json')
  await fs.mkdir(tmpDir, { recursive: true })
}

async function cleanupTmpDirs(): Promise<void> {
  delete process.env.CLAUDE_CONFIG_DIR
  delete process.env.AGENT_CODE_WORKSPACE_DIR
  delete process.env.AGENT_CODE_PROJECTS_FILE
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}

function makeRequest(method: string, pathname: string, body?: unknown) {
  const url = new URL(`http://localhost${pathname}`)
  const req = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  })
  const segments = url.pathname.split('/').filter(Boolean)
  return { req, url, segments }
}

describe('ProjectService', () => {
  beforeEach(setupTmpDirs)
  afterEach(cleanupTmpDirs)

  test('creates a project directory, README, and registry entry', async () => {
    const service = new ProjectService()
    const project = await service.createProject({
      name: 'My Test Project',
      description: 'Build a useful thing.',
    })

    expect(project.name).toBe('My Test Project')
    expect(project.description).toBe('Build a useful thing.')
    expect(project.slug).toBe('my-test-project')
    expect(project.path).toBe(path.join(tmpDir, 'workspace', 'my-test-project'))

    const readme = await fs.readFile(path.join(project.path, 'README.md'), 'utf-8')
    expect(readme).toContain('# My Test Project')
    expect(readme).toContain('Build a useful thing.')

    const registry = JSON.parse(
      await fs.readFile(path.join(tmpDir, '.claude', 'agent-code-projects.json'), 'utf-8'),
    )
    expect(registry.projects).toHaveLength(1)
    expect(registry.projects[0].id).toBe(project.id)
  })

  test('deduplicates slugs when directories already exist', async () => {
    const service = new ProjectService()
    await service.createProject({ name: 'Same Name' })
    const second = await service.createProject({ name: 'Same Name' })

    expect(second.slug).toBe('same-name-2')
    expect(second.path).toBe(path.join(tmpDir, 'workspace', 'same-name-2'))
  })
})

describe('Projects API', () => {
  beforeEach(setupTmpDirs)
  afterEach(cleanupTmpDirs)

  test('POST /api/projects creates and GET /api/projects lists projects', async () => {
    const create = makeRequest('POST', '/api/projects', {
      name: 'API Project',
      description: 'Created through API',
    })
    const createRes = await handleProjectsApi(create.req, create.url, create.segments)
    expect(createRes.status).toBe(201)
    const createBody = await createRes.json()
    expect(createBody.project.name).toBe('API Project')

    const list = makeRequest('GET', '/api/projects')
    const listRes = await handleProjectsApi(list.req, list.url, list.segments)
    expect(listRes.status).toBe(200)
    const listBody = await listRes.json()
    expect(listBody.projects).toHaveLength(1)
    expect(listBody.workspaceDir).toBe(path.join(tmpDir, 'workspace'))
  })

  test('rejects invalid project names', async () => {
    const request = makeRequest('POST', '/api/projects', { name: '' })
    const response = await handleProjectsApi(request.req, request.url, request.segments)
    expect(response.status).toBe(400)
  })
})
