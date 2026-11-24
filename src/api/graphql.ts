/** Minimal GraphQL client: POST to /graphql on the same origin (Caddy / the Vite proxy route it to Django). */

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    readonly messages: string[] = [message],
  ) {
    super(message)
    this.name = 'GraphQLRequestError'
  }
}

interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string }[]
}

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  let response: Response
  try {
    response = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin', // the guest cookie identifies the author of shadow-banned comments
      body: JSON.stringify({ query, variables }),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new GraphQLRequestError('Network error, check the connection')
  }
  if (!response.ok) {
    throw new GraphQLRequestError(`Server error (${response.status})`)
  }
  const body = (await response.json()) as GraphQLResponse<T>
  if (body.errors?.length) {
    const messages = body.errors.map((error) => error.message)
    throw new GraphQLRequestError(messages[0] ?? 'Request failed', messages)
  }
  if (body.data === undefined) {
    throw new GraphQLRequestError('Empty response')
  }
  return body.data
}
