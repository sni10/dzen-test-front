/**
 * The bridge between the API clients and the auth store (which registers itself here), so api/ does not import
 * stores/. Every request asks for a fresh access token; a REST 401 gets one refresh-and-retry.
 */
type TokenProvider = () => Promise<string | null>
type Refresher = () => Promise<boolean>

let tokenProvider: TokenProvider = async () => null
let refresher: Refresher = async () => false

export function setSessionHooks(provide: TokenProvider, refresh: Refresher) {
  tokenProvider = provide
  refresher = refresh
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await tokenProvider()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function refreshSession(): Promise<boolean> {
  return refresher()
}
