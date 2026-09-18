export function useLightbox() {
  const src = ref<string | null>(null);

  function open(source: string) {
    src.value = source;
  }

  function close() {
    src.value = null;
  }

  return { src, open, close };
}
