<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { getCaptcha } from '@/api/posting'
import AppIcon from '@/components/ui/AppIcon.vue'

defineProps<{ error?: string; inputId: string }>()
const answer = defineModel<string>('answer', { required: true })
const key = defineModel<string>('captchaKey', { required: true })
const emit = defineEmits<{ blur: [] }>()

const image = ref('')
const loading = ref(false)
const loadError = ref<string | null>(null)
const input = ref<HTMLInputElement | null>(null)

/** A new picture; the old one is single-use on the server anyway */
async function refresh() {
  loading.value = true
  loadError.value = null
  answer.value = ''
  try {
    const captcha = await getCaptcha()
    key.value = captcha.key
    image.value = captcha.image
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Could not load the CAPTCHA'
  } finally {
    loading.value = false
  }
}

function focus() {
  input.value?.focus()
}

onMounted(refresh)
defineExpose({ refresh, focus })
</script>

<template>
  <div>
    <label :for="inputId" class="mb-1 block text-sm font-medium">
      CAPTCHA <span class="text-danger">*</span>
    </label>
    <div class="flex flex-wrap items-center gap-2">
      <div
        class="flex h-[60px] w-[180px] items-center justify-center overflow-hidden rounded-lg border border-line bg-card-header"
      >
        <img
          v-if="image"
          :src="image"
          alt="CAPTCHA: type the characters from this picture"
          width="180"
          height="60"
          class="transition-opacity"
          :class="{ 'opacity-40': loading }"
        />
        <span v-else-if="loadError" class="px-2 text-center text-xs text-danger">{{
          loadError
        }}</span>
      </div>
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-accent transition-colors hover:bg-card-header disabled:opacity-50"
        :disabled="loading"
        title="Another picture"
        aria-label="Another CAPTCHA picture"
        @click="refresh"
      >
        <AppIcon name="refresh" :class="{ 'animate-spin': loading }" />
      </button>
      <input
        :id="inputId"
        ref="input"
        v-model="answer"
        type="text"
        inputmode="text"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        maxlength="10"
        class="field w-32"
        :class="{ 'field-error': error }"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? `${inputId}-error` : undefined"
        @blur="emit('blur')"
      />
    </div>
    <p v-if="error" :id="`${inputId}-error`" class="mt-1 text-sm text-danger">{{ error }}</p>
  </div>
</template>
