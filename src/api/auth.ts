import { request } from './rest'

export interface Me {
  id: string
  username: string
  email: string
  homePage: string
  isModerator: boolean
}

export interface Session {
  access: string
  user: Me
}

interface RestSession {
  access: string
  user: { id: number; username: string; email: string; home_page: string; is_moderator: boolean }
}

/** REST field names -> dialog field names */
export const AUTH_FIELDS: Record<string, string> = {
  username: 'username',
  email: 'email',
  password: 'password',
  captcha: 'captchaAnswer',
  captcha_key: 'captchaAnswer',
  captcha_answer: 'captchaAnswer',
  login: 'login',
  token: 'token',
  non_field_errors: 'form',
}

function fromRest(session: RestSession): Session {
  const { user } = session
  return {
    access: session.access,
    user: {
      id: String(user.id),
      username: user.username,
      email: user.email,
      homePage: user.home_page,
      isModerator: user.is_moderator,
    },
  }
}

// The refresh token travels only as an httpOnly cookie on /api/auth/: these calls send no Bearer header
const post = async (path: string, body?: unknown) =>
  fromRest(await request<RestSession>(path, { method: 'POST', body, auth: false }))

export const login = (loginName: string, password: string) =>
  post('/api/auth/login/', { login: loginName, password })

export const register = (data: {
  username: string
  email: string
  password: string
  captchaKey: string
  captchaAnswer: string
}) =>
  post('/api/auth/register/', {
    username: data.username,
    email: data.email,
    password: data.password,
    captcha_key: data.captchaKey,
    captcha_answer: data.captchaAnswer,
  })

export const refresh = () => post('/api/auth/refresh/')

export async function logout(): Promise<void> {
  await request('/api/auth/logout/', { method: 'POST', auth: false })
}

/** Always the same answer: it never reveals whether the address has an account */
export async function requestPasswordReset(email: string): Promise<void> {
  await request('/api/auth/password-reset/', { method: 'POST', body: { email }, auth: false })
}

/** The link from the e-mail: sets the new password and signs this browser in */
export const confirmPasswordReset = (uid: string, token: string, password: string) =>
  post('/api/auth/password-reset/confirm/', { uid, token, password })
