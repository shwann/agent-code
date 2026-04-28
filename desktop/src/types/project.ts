export type ProjectRecord = {
  id: string
  name: string
  description: string
  slug: string
  path: string
  createdAt: string
  updatedAt: string
}

export type ProjectsResponse = {
  projects: ProjectRecord[]
  workspaceDir: string
}

export type ProjectResponse = {
  project: ProjectRecord
}

export type CreateProjectInput = {
  name: string
  description?: string
}
