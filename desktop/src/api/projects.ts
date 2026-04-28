import { api } from './client'
import type {
  CreateProjectInput,
  ProjectResponse,
  ProjectsResponse,
} from '../types/project'

export const projectsApi = {
  list() {
    return api.get<ProjectsResponse>('/api/projects')
  },

  create(input: CreateProjectInput) {
    return api.post<ProjectResponse>('/api/projects', input)
  },
}
