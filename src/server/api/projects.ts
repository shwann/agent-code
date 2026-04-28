import { ApiError, errorResponse } from '../middleware/errorHandler.js'
import { projectService } from '../services/projectService.js'

export async function handleProjectsApi(
  req: Request,
  _url: URL,
  segments: string[],
): Promise<Response> {
  try {
    const projectId = segments[2]

    if (!projectId) {
      switch (req.method) {
        case 'GET':
          return Response.json(await projectService.listProjects())
        case 'POST':
          return await createProject(req)
        default:
          return Response.json(
            { error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
            { status: 405 },
          )
      }
    }

    switch (req.method) {
      case 'GET':
        return await getProject(projectId)
      case 'PUT':
        return await updateProject(req, projectId)
      case 'DELETE':
        await projectService.deleteProject(projectId)
        return Response.json({ ok: true })
      default:
        return Response.json(
          { error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
          { status: 405 },
        )
    }
  } catch (error) {
    return errorResponse(error)
  }
}

async function createProject(req: Request): Promise<Response> {
  const body = await readJson(req)
  const project = await projectService.createProject({
    name: getString(body, 'name'),
    description: getOptionalString(body, 'description'),
  })
  return Response.json({ project }, { status: 201 })
}

async function getProject(projectId: string): Promise<Response> {
  const project = await projectService.getProject(projectId)
  if (!project) {
    throw ApiError.notFound(`Project not found: ${projectId}`)
  }
  return Response.json({ project })
}

async function updateProject(req: Request, projectId: string): Promise<Response> {
  const body = await readJson(req)
  const project = await projectService.updateProject(projectId, {
    name: getOptionalString(body, 'name'),
    description: getOptionalString(body, 'description'),
  })
  return Response.json({ project })
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw ApiError.badRequest('Request body must be an object')
    }
    return body as Record<string, unknown>
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw ApiError.badRequest('Invalid JSON body')
  }
}

function getString(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  if (typeof value !== 'string') {
    throw ApiError.badRequest(`${key} must be a string`)
  }
  return value
}

function getOptionalString(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    throw ApiError.badRequest(`${key} must be a string`)
  }
  return value
}
