<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/rest'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const uid = computed(() => String(route.query.uid ?? ''))
const token = computed(() => String(route.query.token ?? ''))
const hasLink = computed(() => Boolean(uid.value && token.value))

const password = ref('')
const error = ref<string | null>(null)
/** The link itself is bad or used: only a new link helps */
const linkError = ref<string | null>(null)
const submitting = ref(false)

async function submit() {
  error.value = password.value.length >= 8 ? null : 'At least 8 characters'
  if (error.value) return
  submitting.value = true
  try {
    await auth.resetPassword(uid.value, token.value, password.value)
    // Signed in with the new password; drop the secret token from the address bar and history
    await router.replace({ name: 'home' })
  } catch (err) {
    if (err instanceof ApiError && err.fields.token) linkError.value = err.fields.token.join(' ')
    else if (err instanceof ApiError) error.value = err.fields.password?.join(' ') ?? err.message
    else error.value = 'Something went wrong, try again'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm space-y-5">
    <RouterLink to="/" class="btn-back">
      <AppIcon name="chevronLeft" :size="16" />
      All comments
    </RouterLink>

    <section class="space-y-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <h1 class="text-xl font-bold">Set a new password</h1>

      <p
        v-if="!hasLink || linkError"
        class="rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger"
        role="alert"
      >
        {{ linkError ?? 'This page opens from the link in the e-mail.' }}
        Ask for a new link with "Forgot password?" in the sign-in window.
      </p>

      <form v-else class="space-y-4" novalidate aria-label="New password" @submit.prevent="submit">
        <div>
          <label for="reset-password" class="mb-1 block text-sm font-medium">New password</label>
          <input
            id="reset-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            class="field w-full"
            :class="{ 'field-error': error }"
          />
          <p v-if="error" class="mt-1 text-sm text-danger">{{ error }}</p>
          <p v-else class="mt-1 text-xs text-muted">Other devices will be signed out.</p>
        </div>
        <button type="submit" class="btn-primary w-full" :disabled="submitting">
          {{ submitting ? 'Please wait…' : 'Save and sign in' }}
        </button>
      </form>
    </section>
  </div>
</template>
