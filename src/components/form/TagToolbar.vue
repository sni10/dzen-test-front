<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { type ToolbarTag, wrapSelection } from '@/utils/markup-edit'

const props = defineProps<{ target: HTMLTextAreaElement | null }>()
const text = defineModel<string>({ required: true })

const BUTTONS: { tag: ToolbarTag; label: string; title: string; class: string }[] = [
  { tag: 'i', label: 'i', title: 'Italic <i>', class: 'italic' },
  { tag: 'strong', label: 'strong', title: 'Bold <strong>', class: 'font-bold' },
  { tag: 'code', label: 'code', title: 'Code <code>', class: 'font-mono' },
  { tag: 'a', label: 'a', title: 'Link <a href="" title="">', class: 'underline' },
]

const linkOpen = ref(false)
const href = ref('https://')
const title = ref('')
const hrefInput = ref<HTMLInputElement | null>(null)

async function apply(tag: ToolbarTag, link?: { href: string; title?: string }) {
  const area = props.target
  const start = area?.selectionStart ?? text.value.length
  const end = area?.selectionEnd ?? text.value.length
  const edit = wrapSelection(text.value, start, end, tag, link)
  text.value = edit.text
  await nextTick()
  area?.focus()
  area?.setSelectionRange(edit.selectionStart, edit.selectionEnd)
}

async function onButton(tag: ToolbarTag) {
  if (tag !== 'a') return apply(tag)
  linkOpen.value = !linkOpen.value
  if (linkOpen.value) {
    await nextTick()
    hrefInput.value?.select()
  }
}

async function insertLink() {
  if (!/^(https?:\/\/|mailto:)\S+$/i.test(href.value.trim())) {
    hrefInput.value?.focus()
    return
  }
  linkOpen.value = false
  await apply('a', { href: href.value, title: title.value })
  href.value = 'https://'
  title.value = ''
}
</script>

<template>
  <div class="relative">
    <div class="flex gap-1" role="toolbar" aria-label="Formatting">
      <button
        v-for="button in BUTTONS"
        :key="button.tag"
        type="button"
        class="rounded-md border border-line bg-card px-2 py-0.5 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
        :class="[button.class, { 'border-accent text-accent': button.tag === 'a' && linkOpen }]"
        :title="button.title"
        :aria-label="button.title"
        @mousedown.prevent
        @click="onButton(button.tag)"
      >
        [{{ button.label }}]
      </button>
    </div>

    <Transition name="pop">
      <form
        v-if="linkOpen"
        class="absolute top-full left-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-xl border border-line bg-card p-3 shadow-lg"
        aria-label="Insert a link"
        @submit.prevent="insertLink"
        @keydown.esc="linkOpen = false"
      >
        <input
          ref="hrefInput"
          v-model="href"
          type="url"
          class="field w-full"
          placeholder="https://example.com"
          aria-label="Link address"
        />
        <input
          v-model="title"
          type="text"
          class="field w-full"
          placeholder="Title (optional)"
          aria-label="Link title"
        />
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="linkOpen = false">Cancel</button>
          <button type="submit" class="btn-primary">Insert</button>
        </div>
      </form>
    </Transition>
  </div>
</template>

<style scoped>
.pop-enter-active,
.pop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
