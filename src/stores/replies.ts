import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Only one reply form is open at a time: opening another closes the previous one */
export const useReplyStore = defineStore('replies', () => {
  const activeId = ref<string | null>(null)

  function open(id: string) {
    activeId.value = id
  }

  function close(id?: string) {
    if (id === undefined || activeId.value === id) activeId.value = null
  }

  return { activeId, open, close }
})
