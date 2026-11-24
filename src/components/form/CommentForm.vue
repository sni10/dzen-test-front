<script setup lang="ts">
import { computed, nextTick, reactive, ref, useId } from 'vue'

import { type NewComment, FIELD_NAMES, postComment, previewComment } from '@/api/posting'
import { ApiError } from '@/api/rest'
import type { Comment } from '@/api/types'
import AppIcon from '@/components/ui/AppIcon.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useAuthorStore } from '@/stores/author'
import { validateMarkup } from '@/utils/markup'
import {
  type FieldErrors,
  type FormField,
  TEXT_MAX_LENGTH,
  validateAttachment,
  validateField,
  validateForm,
} from '@/utils/validation'

import AttachmentField from './AttachmentField.vue'
import CaptchaField from './CaptchaField.vue'
import TagToolbar from './TagToolbar.vue'

const props = defineProps<{ parent?: Comment | null }>()
const emit = defineEmits<{ created: [comment: Comment]; cancel: [] }>()

const author = useAuthorStore()
const id = useId()

const form = reactive<NewComment>({
  ...author.fields,
  text: '',
  parentId: props.parent?.id ?? null,
  captchaKey: '',
  captchaAnswer: '',
  attachment: null,
})
const errors = ref<FieldErrors>({})
const touched = reactive(new Set<FormField>())
const submitting = ref(false)

const preview = ref<string | null>(null)
const previewing = ref(false)

const textArea = ref<HTMLTextAreaElement | null>(null)
const captcha = ref<InstanceType<typeof CaptchaField> | null>(null)

const isReply = computed(() => Boolean(props.parent))
const textLength = computed(() => form.text.length)

/** Check a field once the user has left it; afterwards re-check on every change */
function check(field: FormField) {
  touched.add(field)
  errors.value = { ...errors.value, [field]: validateField(field, form[field]) }
}

function onInput(field: FormField) {
  if (touched.has(field) || errors.value[field]) check(field)
  if (field === 'text') preview.value = null
}

/** Put the caret on the markup problem the validator found */
async function showProblem() {
  const problem = validateMarkup(form.text)
  if (!problem || !textArea.value) return
  await nextTick()
  textArea.value.focus()
  const end = form.text.indexOf('>', problem.position)
  textArea.value.setSelectionRange(problem.position, end === -1 ? problem.position + 1 : end + 1)
}

async function togglePreview() {
  if (preview.value !== null) {
    preview.value = null
    return
  }
  check('text')
  if (errors.value.text) return void showProblem()
  previewing.value = true
  try {
    preview.value = await previewComment(form.text)
  } catch (err) {
    errors.value = { ...errors.value, text: err instanceof Error ? err.message : 'Preview failed' }
  } finally {
    previewing.value = false
  }
}

function checkAttachment() {
  errors.value = { ...errors.value, attachment: validateAttachment(form.attachment) }
}

function focusFirstError() {
  const first = (['userName', 'email', 'homePage', 'text', 'captchaAnswer'] as const).find(
    (field) => errors.value[field],
  )
  if (!first && errors.value.attachment) return document.getElementById(`${id}-attachment`)?.focus()
  if (first === 'captchaAnswer') return captcha.value?.focus()
  if (first === 'text') return void showProblem()
  if (first) document.getElementById(`${id}-${first}`)?.focus()
}

function applyServerErrors(error: ApiError) {
  const next: FieldErrors = {}
  for (const [field, messages] of Object.entries(error.fields)) {
    const target = FIELD_NAMES[field] ?? 'form'
    const message = messages[0]
    if (message && target !== 'captchaKey' && target !== 'parentId') {
      next[target as keyof FieldErrors] = message
    }
  }
  if (!Object.keys(next).length) next.form = error.message
  errors.value = next
}

async function submit() {
  for (const field of ['userName', 'email', 'homePage', 'text', 'captchaAnswer'] as const)
    touched.add(field)
  errors.value = validateForm(form)
  if (Object.keys(errors.value).length) return focusFirstError()

  submitting.value = true
  try {
    const comment = await postComment({ ...form, text: form.text.trim() })
    author.remember({
      userName: form.userName.trim(),
      email: form.email.trim(),
      homePage: form.homePage.trim(),
    })
    form.text = ''
    form.attachment = null
    preview.value = null
    errors.value = {}
    touched.clear()
    emit('created', comment)
    void captcha.value?.refresh()
  } catch (err) {
    if (err instanceof ApiError) {
      applyServerErrors(err)
      // Any attempt uses the CAPTCHA up on the server: always show a new one after an error
      if (err.status !== 0) void captcha.value?.refresh()
      focusFirstError()
    } else {
      errors.value = { form: 'Something went wrong, try again' }
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form
    class="space-y-4"
    novalidate
    :aria-label="isReply ? `Reply to ${parent?.userName}` : 'New comment'"
    @submit.prevent="submit"
  >
    <div class="grid gap-4 sm:grid-cols-3">
      <div>
        <label :for="`${id}-userName`" class="mb-1 block text-sm font-medium">
          User Name <span class="text-danger">*</span>
        </label>
        <input
          :id="`${id}-userName`"
          v-model="form.userName"
          type="text"
          autocomplete="nickname"
          maxlength="50"
          placeholder="Latin letters and digits"
          class="field w-full"
          :class="{ 'field-error': errors.userName }"
          :aria-invalid="Boolean(errors.userName)"
          @blur="check('userName')"
          @input="onInput('userName')"
        />
        <p v-if="errors.userName" class="mt-1 text-sm text-danger">{{ errors.userName }}</p>
      </div>
      <div>
        <label :for="`${id}-email`" class="mb-1 block text-sm font-medium">
          E-mail <span class="text-danger">*</span>
        </label>
        <input
          :id="`${id}-email`"
          v-model="form.email"
          type="email"
          autocomplete="email"
          maxlength="254"
          placeholder="you@example.com"
          class="field w-full"
          :class="{ 'field-error': errors.email }"
          :aria-invalid="Boolean(errors.email)"
          @blur="check('email')"
          @input="onInput('email')"
        />
        <p v-if="errors.email" class="mt-1 text-sm text-danger">{{ errors.email }}</p>
      </div>
      <div>
        <label :for="`${id}-homePage`" class="mb-1 block text-sm font-medium">Home page</label>
        <input
          :id="`${id}-homePage`"
          v-model="form.homePage"
          type="url"
          autocomplete="url"
          maxlength="200"
          placeholder="https://"
          class="field w-full"
          :class="{ 'field-error': errors.homePage }"
          :aria-invalid="Boolean(errors.homePage)"
          @blur="check('homePage')"
          @input="onInput('homePage')"
        />
        <p v-if="errors.homePage" class="mt-1 text-sm text-danger">{{ errors.homePage }}</p>
      </div>
    </div>

    <div>
      <div class="mb-1 flex flex-wrap items-end justify-between gap-2">
        <label :for="`${id}-text`" class="text-sm font-medium">
          Text <span class="text-danger">*</span>
        </label>
        <TagToolbar v-model="form.text" :target="textArea" @update:model-value="onInput('text')" />
      </div>

      <div
        v-if="preview !== null"
        class="rounded-lg border border-dashed border-accent/40 bg-card-header/50 p-3"
      >
        <div class="mb-2 flex items-center gap-2 text-sm">
          <UserAvatar :name="form.userName || '?'" :size="28" />
          <strong>{{ form.userName || 'You' }}</strong>
          <span class="text-muted">· preview</span>
        </div>
        <!-- The server's sanitized result, exactly as it will be stored -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="comment-preview leading-relaxed break-words whitespace-pre-line"
          v-html="preview"
        />
      </div>
      <textarea
        v-else
        :id="`${id}-text`"
        ref="textArea"
        v-model="form.text"
        rows="5"
        :maxlength="TEXT_MAX_LENGTH + 100"
        placeholder='Allowed tags: <i>, <strong>, <code>, <a href="" title="">'
        class="field block w-full resize-y"
        :class="{ 'field-error': errors.text }"
        :aria-invalid="Boolean(errors.text)"
        @blur="check('text')"
        @input="onInput('text')"
      />

      <div class="mt-1 flex justify-between gap-2 text-sm">
        <p v-if="errors.text" class="text-danger">
          {{ errors.text }}
          <button
            v-if="validateMarkup(form.text)"
            type="button"
            class="ml-1 underline"
            @click="showProblem"
          >
            Show
          </button>
        </p>
        <span v-else />
        <span :class="textLength > TEXT_MAX_LENGTH ? 'text-danger' : 'text-muted'">
          {{ textLength }} / {{ TEXT_MAX_LENGTH }}
        </span>
      </div>
    </div>

    <AttachmentField
      v-model="form.attachment"
      :input-id="`${id}-attachment`"
      :error="errors.attachment"
      @change="checkAttachment"
    />

    <CaptchaField
      ref="captcha"
      v-model:answer="form.captchaAnswer"
      v-model:captcha-key="form.captchaKey"
      :input-id="`${id}-captcha`"
      :error="errors.captchaAnswer"
      @blur="check('captchaAnswer')"
    />

    <p v-if="errors.form" class="rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">
      {{ errors.form }}
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? 'Sending…' : isReply ? 'Reply' : 'Post comment' }}
      </button>
      <button type="button" class="btn-ghost" :disabled="previewing" @click="togglePreview">
        <AppIcon name="eye" :size="16" />
        {{ preview !== null ? 'Edit' : previewing ? 'Loading…' : 'Preview' }}
      </button>
      <button v-if="isReply" type="button" class="btn-ghost ml-auto" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>
