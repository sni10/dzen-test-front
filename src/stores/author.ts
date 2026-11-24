import { defineStore } from 'pinia'
import { reactive } from 'vue'

const KEY = 'comments.author'

export interface AuthorFields {
  userName: string
  email: string
  homePage: string
}

function load(): AuthorFields {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AuthorFields>
    return {
      userName: saved.userName ?? '',
      email: saved.email ?? '',
      homePage: saved.homePage ?? '',
    }
  } catch {
    return { userName: '', email: '', homePage: '' }
  }
}

/** Name, e-mail and home page are remembered in this browser so the next comment is quicker */
export const useAuthorStore = defineStore('author', () => {
  const fields = reactive<AuthorFields>(load())

  function remember(next: AuthorFields) {
    Object.assign(fields, next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // private mode / storage disabled: just not remembered
    }
  }

  return { fields, remember }
})
