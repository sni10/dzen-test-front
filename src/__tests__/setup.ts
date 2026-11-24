import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, vi } from 'vitest'

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

/** A WebSocket that never touches the network; tests drive it with open() / emit() / drop() */
export class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  onopen: (() => void) | null = null
  onmessage: ((message: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  closed = false

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  open() {
    this.onopen?.()
  }

  emit(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) })
  }

  drop() {
    this.onclose?.()
  }

  close() {
    this.closed = true
    this.onclose?.()
  }
}

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
})
