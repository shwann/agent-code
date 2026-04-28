import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { z } from 'zod/v4'
import { ApiError } from '../middleware/errorHandler.js'

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  slug: z.string(),
  path: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const ProjectRegistrySchema = z.object({
  version: z.literal(1).default(1),
  projects: z.array(ProjectSchema).default([]),
})

export type ProjectRecord = z.infer<typeof ProjectSchema>
type ProjectRegistry = z.infer<typeof ProjectRegistrySchema>

export type CreateProjectInput = {
  name: string
  description?: string
}

export type UpdateProjectInput = {
  name?: string
  description?: string
}

export class ProjectService {
  private getConfigDir(): string {
    return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  }

  getWorkspaceDir(): string {
    return path.resolve(
      process.env.AGENT_CODE_WORKSPACE_DIR || path.join(os.homedir(), 'workspace'),
    )
  }

  getRegistryPath(): string {
    return path.resolve(
      process.env.AGENT_CODE_PROJECTS_FILE ||
        path.join(this.getConfigDir(), 'agent-code-projects.json'),
    )
  }

  async listProjects(): Promise<{ projects: ProjectRecord[]; workspaceDir: string }> {
    const registry = await this.readRegistry()
    const projects = [...registry.projects].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    return { projects, workspaceDir: this.getWorkspaceDir() }
  }

  async getProject(id: string): Promise<ProjectRecord | null> {
    const registry = await this.readRegistry()
    return registry.projects.find((project) => project.id === id) ?? null
  }

  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const name = normalizeName(input.name)
    if (!name) {
      throw ApiError.badRequest('Project name is required')
    }

    const description = normalizeDescription(input.description)
    const registry = await this.readRegistry()
    const workspaceDir = this.getWorkspaceDir()
    await fs.mkdir(workspaceDir, { recursive: true })

    const slug = await this.createUniqueSlug(slugify(name), registry.projects)
    const projectPath = this.resolveProjectPath(slug)
    await fs.mkdir(projectPath, { recursive: true })
    await this.writeProjectReadme(projectPath, name, description)

    const now = new Date().toISOString()
    const project: ProjectRecord = {
      id: crypto.randomUUID(),
      name,
      description,
      slug,
      path: projectPath,
      createdAt: now,
      updatedAt: now,
    }

    registry.projects.push(project)
    await this.writeRegistry(registry)
    return project
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<ProjectRecord> {
    const registry = await this.readRegistry()
    const idx = registry.projects.findIndex((project) => project.id === id)
    if (idx === -1) {
      throw ApiError.notFound(`Project not found: ${id}`)
    }

    const existing = registry.projects[idx]!
    const name = input.name === undefined ? existing.name : normalizeName(input.name)
    if (!name) {
      throw ApiError.badRequest('Project name is required')
    }

    const project: ProjectRecord = {
      ...existing,
      name,
      description:
        input.description === undefined
          ? existing.description
          : normalizeDescription(input.description),
      updatedAt: new Date().toISOString(),
    }

    registry.projects[idx] = project
    await this.writeRegistry(registry)
    return project
  }

  async deleteProject(id: string): Promise<void> {
    const registry = await this.readRegistry()
    const nextProjects = registry.projects.filter((project) => project.id !== id)
    if (nextProjects.length === registry.projects.length) {
      throw ApiError.notFound(`Project not found: ${id}`)
    }

    await this.writeRegistry({ ...registry, projects: nextProjects })
  }

  private resolveProjectPath(slug: string): string {
    const workspaceDir = this.getWorkspaceDir()
    const projectPath = path.resolve(workspaceDir, slug)
    const relative = path.relative(workspaceDir, projectPath)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw ApiError.badRequest('Project path must stay inside workspace')
    }
    return projectPath
  }

  private async createUniqueSlug(baseSlug: string, projects: ProjectRecord[]): Promise<string> {
    const base = baseSlug || 'project'
    const usedSlugs = new Set(projects.map((project) => project.slug))
    let slug = base
    let counter = 2
    while (usedSlugs.has(slug) || await pathExists(this.resolveProjectPath(slug))) {
      slug = `${base}-${counter}`
      counter += 1
    }
    return slug
  }

  private async readRegistry(): Promise<ProjectRegistry> {
    try {
      const raw = await fs.readFile(this.getRegistryPath(), 'utf-8')
      return ProjectRegistrySchema.parse(JSON.parse(raw))
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { version: 1, projects: [] }
      }
      if (err instanceof SyntaxError || err instanceof z.ZodError) {
        throw ApiError.internal(`Invalid project registry: ${err.message}`)
      }
      throw ApiError.internal(`Failed to read project registry: ${err}`)
    }
  }

  private async writeRegistry(registry: ProjectRegistry): Promise<void> {
    const registryPath = this.getRegistryPath()
    await fs.mkdir(path.dirname(registryPath), { recursive: true })
    const tmpPath = `${registryPath}.tmp.${Date.now()}`
    try {
      await fs.writeFile(tmpPath, JSON.stringify(registry, null, 2) + '\n', 'utf-8')
      await fs.rename(tmpPath, registryPath)
    } catch (err) {
      await fs.unlink(tmpPath).catch(() => {})
      throw ApiError.internal(`Failed to write project registry: ${err}`)
    }
  }

  private async writeProjectReadme(
    projectPath: string,
    name: string,
    description: string,
  ): Promise<void> {
    const readmePath = path.join(projectPath, 'README.md')
    if (await pathExists(readmePath)) {
      return
    }
    const lines = [`# ${name}`, '']
    if (description) {
      lines.push(description, '')
    }
    await fs.writeFile(readmePath, lines.join('\n'), 'utf-8')
  }
}

function normalizeName(name: string): string {
  return String(name ?? '').trim().replace(/\s+/g, ' ')
}

function normalizeDescription(description?: string): string {
  return String(description ?? '').trim()
}

function slugify(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return normalized || 'project'
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

export const projectService = new ProjectService()
