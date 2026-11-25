<script setup lang="ts">
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'

import { AUTH_FIELDS } from '@/api/auth'
import { ApiError } from '@/api/rest'
import CaptchaField from '@/components/form/CaptchaField.vue'
import { type AuthMode, useAuthStore } from '@/stores/auth'
import { validateField } from '@/utils/validation'

const mode = defineModel<AuthMode | null>({ required: true })

const auth = useAuthStore()
const id = useId()

const form = reactive({
  login: '',
  username: '',
  email: '',
  password: '',
  captchaKey: '',
  captchaAnswer: '',
})
const errors = ref<Record<string, string | undefined>>({})
const submitting = ref(false)
const firstInput = ref<HTMLInputElement | null>(null)
const captcha = ref<InstanceType<typeof CaptchaField> | null>(null)

const isRegister = computed(() => mode.value === 'register')
const title = computed(() => (isRegister.value ? 'Create an account' : 'Sign in'))

watch(mode, async (next) => {
  errors.value = {}
  form.password = ''
  if (next) {
    await nextTick()
    firstInput.value?.focus()
  }
})

/** The same rules as the server: name as in the comment form, an e-mail, 8+ characters of password */
function check(): boolean {
  const next: Record<string, string | undefined> = {}
  if (isRegister.value) {
    next.username = validateField('userName', form.username)
    next.email = validateField('email', form.email)
    next.captchaAnswer = validateField('captchaAnswer', form.captchaAnswer)
    if (form.password.length < 8) next.password = 'At least 8 characters'
  } else {
    if (!form.login.trim()) next.login = 'Enter your name or e-mail'
    if (!form.password) next.password = 'Enter your password'
  }
  errors.value = next
  return !Object.values(next).some(Boolean)
}

async function submit() {
  if (!check()) return
  submitting.value = true
  try {
    if (isRegister.value) {
      await auth.register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        captchaKey: form.captchaKey,
        captchaAnswer: form.captchaAnswer,
      })
    } else {
      await auth.login(form.login.trim(), form.password)
    }
    form.password = ''
    mode.value = null
  } catch (err) {
    const next: Record<string, string> = {}
    if (err instanceof ApiError) {
      for (const [field, messages] of Object.entries(err.fields)) {
        next[AUTH_FIELDS[field] ?? 'form'] = messages.join(' ')
      }
      if (!Object.keys(next).length) next.form = err.message
    } else {
      next.form = 'Something went wrong, try again'
    }
    errors.value = next
    if (isRegister.value) void captcha.value?.refresh() // the server spends the CAPTCHA on every attempt
  } finally {
    submitting.value = false
  }
}

function switchMode() {
  mode.value = isRegister.value ? 'login' : 'register'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="mode"
        class="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
        @click.self="mode = null"
        @keydown.esc="mode = null"
      >
        <form
          class="dialog-card w-full max-w-sm space-y-4 rounded-2xl bg-card p-6 shadow-2xl"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`${id}-title`"
          novalidate
          @submit.prevent="submit"
        >
          <h2 :id="`${id}-title`" class="text-xl font-bold">{{ title }}</h2>

          <template v-if="isRegister">
            <div>
              <label :for="`${id}-username`" class="mb-1 block text-sm font-medium"
                >User Name</label
              >
              <input
                :id="`${id}-username`"
                ref="firstInput"
                v-model="form.username"
                autocomplete="username"
                maxlength="50"
                placeholder="Latin letters and digits"
                class="field w-full"
                :class="{ 'field-error': errors.username }"
              />
              <p v-if="errors.username" class="mt-1 text-sm text-danger">{{ errors.username }}</p>
            </div>
            <div>
              <label :for="`${id}-email`" class="mb-1 block text-sm font-medium">E-mail</label>
              <input
                :id="`${id}-email`"
                v-model="form.email"
                type="email"
                autocomplete="email"
                class="field w-full"
                :class="{ 'field-error': errors.email }"
              />
              <p v-if="errors.email" class="mt-1 text-sm text-danger">{{ errors.email }}</p>
            </div>
          </template>
          <div v-else>
            <label :for="`${id}-login`" class="mb-1 block text-sm font-medium"
              >Name or e-mail</label
            >
            <input
              :id="`${id}-login`"
              ref="firstInput"
              v-model="form.login"
              autocomplete="username"
              class="field w-full"
              :class="{ 'field-error': errors.login }"
            />
            <p v-if="errors.login" class="mt-1 text-sm text-danger">{{ errors.login }}</p>
          </div>

          <div>
            <label :for="`${id}-password`" class="mb-1 block text-sm font-medium">Password</label>
            <input
              :id="`${id}-password`"
              v-model="form.password"
              type="password"
              :autocomplete="isRegister ? 'new-password' : 'current-password'"
              class="field w-full"
              :class="{ 'field-error': errors.password }"
            />
            <p v-if="errors.password" class="mt-1 text-sm text-danger">{{ errors.password }}</p>
          </div>

          <CaptchaField
            v-if="isRegister"
            ref="captcha"
            v-model:answer="form.captchaAnswer"
            v-model:captcha-key="form.captchaKey"
            :input-id="`${id}-captcha`"
            :error="errors.captchaAnswer"
          />

          <p
            v-if="errors.form"
            class="rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {{ errors.form }}
          </p>

          <button type="submit" class="btn-primary w-full" :disabled="submitting">
            {{ submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in' }}
          </button>

          <p class="text-center text-sm text-muted">
            {{ isRegister ? 'Already have an account?' : 'No account yet?' }}
            <button
              type="button"
              class="font-medium text-accent hover:underline"
              @click="switchMode"
            >
              {{ isRegister ? 'Sign in' : 'Create one' }}
            </button>
          </p>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-enter-active .dialog-card,
.dialog-leave-active .dialog-card {
  transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from .dialog-card,
.dialog-leave-to .dialog-card {
  transform: scale(0.95) translateY(8px);
}
</style>
