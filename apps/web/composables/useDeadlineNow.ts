export function useDeadlineNow(options: { tick?: boolean } = {}) {
  const now = useState<number>('topic-deadline-now', () => Date.now());

  if (options.tick && import.meta.client) {
    let timer: ReturnType<typeof setInterval> | null = null;
    onMounted(() => {
      if (timer !== null) return;
      timer = setInterval(() => { now.value = Date.now(); }, 60_000);
    });
    onUnmounted(() => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    });
  }

  return now;
}
