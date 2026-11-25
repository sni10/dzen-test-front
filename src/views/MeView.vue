<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { changePassword, fetchMyComments, fetchProfile, updateProfile } from '@/api/account'
import { fetchMyBookmarks } from '@/api/reactions'
import { GraphQLRequestError } from '@/api/graphql'
import CommentCard from '@/components/comments/CommentCard.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth'
import { pluralize } from '@/utils/format'
import { parsePage } from '@/utils/sort'
import { validateField } from '@/utils/validation'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const page = computed(() => parsePage(route.query.page))
/** Tab in the URL: ?tab=bookmarks */
const tab = computed(() => (route.query.tab === 'bookmarks' ? 'bookmarks' : 'comments'))
const profile = useAsync(() => fetchProfile())
const mine = useAsync((signal) =>
  tab.value === 'bookmarks'
    ? fetchMyBookmarks(page.value, signal)
    : fetchMyComments(page.value, signal),
)

// The cabinet follows the session: load once signed in (after a reload the session restores first)
watch(
  [() => auth.user?.id, page, tab],
  ([userId]) => {
    if (!userId) return
    void profile.run()
    void mine.run()
  },
  { immediate: true },
)

/** A field error from a mutation (extensions.field), or the message itself */
function problem(error: unknown, field: string): string {
  if (error instanceof GraphQLRequestError) return error.fields[field] ?? error.message
  return 'Something went wrong, try again'
}

const homePage = ref('')
const homePageError = ref<string | undefined>()
const homePageSaved = ref(false)
watch(
  () => profile.data.value?.homePage,
  (value) => (homePage.value = value ?? ''),
)

async function saveHomePage() {
  homePageSaved.value = false
  homePageError.value = validateField('homePage', homePage.value)
  if (homePageError.value) return
  try {
    const updated = await updateProfile(homePage.value.trim())
    auth.setHomePage(updated.homePage)
    homePage.value = updated.homePage
    homePageSaved.value = true
  } catch (error) {
    homePageError.value = problem(error, 'homePage')
  }
}

const password = reactive({ old: '', new: '' })
const passwordErrors = ref<{ old?: string; new?: string }>({})
const passwordChanged = ref(false)

async function savePassword() {
  passwordChanged.value = false
  passwordErrors.value = {
    old: password.old ? undefined : 'Enter your current password',
    new: password.new.length >= 8 ? undefined : 'At least 8 characters',
  }
  if (passwordErrors.value.old || passwordErrors.value.new) return
  try {
    auth.setAccess(await changePassword(password.old, password.new))
    password.old = ''
    password.new = ''
    passwordChanged.value = true
  } catch (error) {
    passwordErrors.value = {
      old: problem(error, 'oldPassword'),
      new: error instanceof GraphQLRequestError ? error.fields.newPassword : undefined,
    }
    if (passwordErrors.value.new) passwordErrors.value.old = undefined
  }
}

function onPage(next: number) {
  const query = { ...route.query, page: next > 1 ? String(next) : undefined }
  void router.push({ query })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function showTab(next: 'comments' | 'bookmarks') {
  void router.push({ query: next === 'bookmarks' ? { tab: next } : {} })
}
</script>

<template>
  <div class="space-y-6">
    <RouterLink to="/" class="text-sm font-medium">← All comments</RouterLink>

    <p v-if="!auth.ready" class="h-28 animate-pulse rounded-2xl bg-card-header" aria-busy="true" />
    <p
      v-else-if="!auth.user"
      class="rounded-2xl border border-line bg-card p-8 text-center text-muted"
    >
      Sign in to see your cabinet.
    </p>

    <template v-else>
      <section class="flex items-center gap-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
        <UserAvatar :name="auth.user.username" :size="64" />
        <div class="min-w-0">
          <h1 class="truncate text-2xl font-bold">{{ auth.user.username }}</h1>
          <p class="truncate text-muted">{{ auth.user.email }}</p>
          <p v-if="profile.data.value" class="mt-1 text-sm text-muted">
            {{ pluralize(profile.data.value.commentsCount, 'comment', 'comments') }}
            <span v-if="profile.data.value.isModerator" class="ml-2 font-semibold text-accent"
              >· moderator</span
            >
          </p>
        </div>
      </section>

      <div class="grid gap-6 md:grid-cols-2">
        <form
          class="space-y-3 rounded-2xl border border-line bg-card p-5 shadow-sm"
          aria-label="Profile"
          novalidate
          @submit.prevent="saveHomePage"
        >
          <h2 class="font-semibold">Profile</h2>
          <label for="me-home-page" class="block text-sm font-medium">Home page</label>
          <input
            id="me-home-page"
            v-model="homePage"
            type="url"
            placeholder="https://"
            class="field w-full"
            :class="{ 'field-error': homePageError }"
            @input="homePageSaved = false"
          />
          <p v-if="homePageError" class="text-sm text-danger">{{ homePageError }}</p>
          <p v-else class="text-xs text-muted">
            Your name links here in comments. Name and e-mail cannot be changed.
          </p>
          <div class="flex items-center gap-3">
            <button type="submit" class="btn-primary">Save</button>
            <span v-if="homePageSaved" class="text-sm text-emerald-600" role="status">Saved</span>
          </div>
        </form>

        <form
          class="space-y-3 rounded-2xl border border-line bg-card p-5 shadow-sm"
          aria-label="Change password"
          novalidate
          @submit.prevent="savePassword"
        >
          <h2 class="font-semibold">Password</h2>
          <div>
            <label for="me-old-password" class="mb-1 block text-sm font-medium"
              >Current password</label
            >
            <input
              id="me-old-password"
              v-model="password.old"
              type="password"
              autocomplete="current-password"
              class="field w-full"
              :class="{ 'field-error': passwordErrors.old }"
            />
            <p v-if="passwordErrors.old" class="mt-1 text-sm text-danger">
              {{ passwordErrors.old }}
            </p>
          </div>
          <div>
            <label for="me-new-password" class="mb-1 block text-sm font-medium">New password</label>
            <input
              id="me-new-password"
              v-model="password.new"
              type="password"
              autocomplete="new-password"
              class="field w-full"
              :class="{ 'field-error': passwordErrors.new }"
            />
            <p v-if="passwordErrors.new" class="mt-1 text-sm text-danger">
              {{ passwordErrors.new }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button type="submit" class="btn-primary">Change password</button>
            <span v-if="passwordChanged" class="text-sm text-emerald-600" role="status">
              Changed; other devices are signed out
            </span>
          </div>
        </form>
      </div>

      <section class="space-y-4">
        <div class="flex gap-1 border-b border-line" role="tablist" aria-label="My lists">
          <button
            v-for="item in [
              { key: 'comments', label: 'My comments' },
              { key: 'bookmarks', label: 'Bookmarks' },
            ] as const"
            :key="item.key"
            type="button"
            role="tab"
            class="-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors"
            :class="
              tab === item.key
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-ink'
            "
            :aria-selected="tab === item.key"
            @click="showTab(item.key)"
          >
            {{ item.label }}
          </button>
        </div>
        <p v-if="mine.error.value" class="text-danger">{{ mine.error.value }}</p>
        <p
          v-else-if="mine.data.value && !mine.data.value.items.length"
          class="rounded-2xl border border-line bg-card p-6 text-center text-muted"
        >
          {{
            tab === 'bookmarks'
              ? 'No bookmarks yet: use the bookmark icon on a comment.'
              : 'You have not posted anything yet.'
          }}
        </p>
        <template v-else-if="mine.data.value">
          <div
            v-for="comment in mine.data.value.items"
            :key="comment.id"
            class="rounded-2xl border border-line bg-card p-3 shadow-sm"
          >
            <CommentCard :comment="comment" no-reply />
          </div>
          <AppPagination :page="page" :page-count="mine.data.value.pageCount" @change="onPage" />
        </template>
        <div v-else class="h-24 animate-pulse rounded-2xl bg-card-header" aria-busy="true" />
      </section>
    </template>
  </div>
</template>
