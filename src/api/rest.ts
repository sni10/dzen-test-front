/** REST calls (CAPTCHA, posting, preview, auth): same origin, JSON, field errors in DRF format. */
import { authHeaders, refreshSession } from './session'

export interface MarkupProblem {
  code: string
  position: number
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** {"field": ["message"]} as returned by the backend */
    readonly fields: Record<string, string[]> = {},
    readonly markup: MarkupProblem | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type ErrorBody = Record<string, unknown> & { detail?: string; markup?: MarkupProblem }

function firstMessage(fields: Record<string, string[]>): string | undefined {
  return Object.values(fields).flat()[0]
}

export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const withAuth = init.auth ?? true
  let response: Response
  try {
    response = await send(path, init, withAuth)
    // An expired access token: refresh once and repeat (the auth endpoints themselves never retry)
    if (response.status === 401 && withAuth && (await refreshSession())) {
      response = await send(path, init, withAuth)
    }
  } catch {
    throw new ApiError('Network error, check the connection', 0)
  }

  return parse<T>(response)
}

async function send(
  path: string,
  init: { method?: string; body?: unknown },
  withAuth: boolean,
): Promise<Response> {
  return fetch(path, {
    method: init.method ?? 'GET',
    headers: {
      ...(withAuth ? await authHeaders() : {}),
      Accept: 'application/json',
      // FormData sets its own multipart Content-Type with the boundary
      ...(init.body === undefined || init.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    credentials: 'same-origin', // the guest cookie
    body:
      init.body === undefined
        ? undefined
        : init.body instanceof FormData
          ? init.body
          : JSON.stringify(init.body),
  })
}

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | ErrorBody | null
  if (response.ok) return body as T

  const errorBody = (body ?? {}) as ErrorBody
  if (response.status === 429) {
    throw new ApiError(errorBody.detail ?? 'Too many requests, try again in a minute', 429)
  }
  const fields: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(errorBody)) {
    if (key === 'markup' || key === 'detail') continue
    if (Array.isArray(value)) fields[key] = value.map(String)
  }
  throw new ApiError(
    firstMessage(fields) ?? errorBody.detail ?? `Server error (${response.status})`,
    response.status,
    fields,
    errorBody.markup ?? null,
  )
}
