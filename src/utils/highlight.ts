/** Scroll a comment into view (if needed) and flash it — for new comments and "go to parent". */
export function highlightComment(id: string, scroll: 'if-needed' | 'center' = 'if-needed') {
  const element = document.getElementById(`c-${id}`)
  if (!element) return false
  const rect = element.getBoundingClientRect()
  const visible = rect.top >= 0 && rect.bottom <= window.innerHeight
  if (scroll === 'center' || !visible) {
    element.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }
  element.classList.remove('flash')
  void element.offsetWidth // restart the animation
  element.classList.add('flash')
  return true
}
