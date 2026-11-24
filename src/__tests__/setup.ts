import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach } from 'vitest'

// A fresh Pinia for every test, installed into every mount (merged with the test's own plugins)
beforeEach(() => {
  const pinia = createPinia()
  setActivePinia(pinia)
  config.global.plugins = [pinia]
  localStorage.clear()
})

// Object URLs for the local preview of a chosen image: Node's own implementation rejects jsdom's File
URL.createObjectURL = () => 'blob:preview'
URL.revokeObjectURL = () => {}
