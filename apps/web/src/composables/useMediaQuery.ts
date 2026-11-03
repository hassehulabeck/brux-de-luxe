import { onBeforeUnmount, ref, type Ref } from 'vue';

/**
 * True while the CSS media query matches, e.g. useMediaQuery('(max-width: 900px)').
 * Used where the layout changes what is rendered, not just how it looks.
 */
export function useMediaQuery(query: string): Ref<boolean> {
  const list = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null;
  const matches = ref(list?.matches ?? false);
  const update = (event: MediaQueryListEvent) => (matches.value = event.matches);
  list?.addEventListener('change', update);
  onBeforeUnmount(() => list?.removeEventListener('change', update));
  return matches;
}
