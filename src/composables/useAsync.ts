import { ref, shallowRef } from 'vue'

/** Runs a request, keeps loading / error / data; a newer run aborts the previous one. */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>) {
  const data = shallowRef<T | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)
  let controller: AbortController | null = null

  async function run() {
    controller?.abort()
    const current = new AbortController()
    controller = current
    loading.value = true
    error.value = null
    try {
      data.value = await load(current.signal)
    } catch (err) {
      if (current.signal.aborted) return
      error.value = err instanceof Error ? err.message : 'Something went wrong'
    } finally {
      if (controller === current) loading.value = false
    }
  }

  return { data, error, loading, run }
}
