import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface LightboxItem {
  kind: 'image' | 'text'
  url: string
  name: string
}

/**
 * One viewer for the whole page. Opening collects every attachment currently on the page (elements with
 * data-lightbox-url, in page order), so the arrows browse them like lightbox2 does.
 */
export const useLightboxStore = defineStore('lightbox', () => {
  const items = ref<LightboxItem[]>([])
  const index = ref(-1)

  const current = computed(() => items.value[index.value] ?? null)

  function open(url: string) {
    const found = [...document.querySelectorAll<HTMLElement>('[data-lightbox-url]')].map((el) => ({
      kind: (el.dataset.lightboxKind === 'text' ? 'text' : 'image') as LightboxItem['kind'],
      url: el.dataset.lightboxUrl ?? '',
      name: el.dataset.lightboxName ?? '',
    }))
    // ponytail: a URL shown twice on the page (a thread and the feed) opens at its first place
    items.value = found.length ? found : [{ kind: 'image', url, name: '' }]
    index.value = Math.max(
      items.value.findIndex((item) => item.url === url),
      0,
    )
  }

  function close() {
    index.value = -1
  }

  function step(delta: number) {
    const count = items.value.length
    if (count > 1) index.value = (index.value + delta + count) % count
  }

  return { items, index, current, open, close, step }
})
