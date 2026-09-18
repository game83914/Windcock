<template>
  <div>
    <div ref="container" />
    <p v-if="!resolvedSiteKey" class="mt-2 text-xs text-[#77716a]">開發模式：略過人機驗證。</p>
  </div>
</template>

<script setup lang="ts">
interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __wcTurnstilePromise?: Promise<TurnstileApi> | null;
  }
}

const props = withDefaults(defineProps<{
  modelValue?: string;
  siteKey?: string;
}>(), {
  modelValue: '',
  siteKey: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'expired': [];
  'error': [];
}>();

const config = useRuntimeConfig();
const resolvedSiteKey = computed(() => props.siteKey || (config.public.turnstileSiteKey as string) || '');
const container = ref<HTMLElement | null>(null);
let widgetId: string | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (window.__wcTurnstilePromise) return window.__wcTurnstilePromise;
  window.__wcTurnstilePromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile 載入失敗'));
    };
    script.onerror = () => reject(new Error('Turnstile 載入失敗'));
    document.head.appendChild(script);
  });
  return window.__wcTurnstilePromise;
}

function reset() {
  emit('update:modelValue', '');
  if (widgetId && window.turnstile) {
    try { window.turnstile.reset(widgetId); } catch { /* Widget 可能已移除 */ }
  }
}

defineExpose({ reset });

onMounted(async () => {
  if (!resolvedSiteKey.value || !container.value) return;
  try {
    const turnstile = await loadTurnstile();
    if (!container.value) return;
    widgetId = turnstile.render(container.value, {
      sitekey: resolvedSiteKey.value,
      callback: (token: string) => emit('update:modelValue', token),
      'expired-callback': () => {
        emit('update:modelValue', '');
        emit('expired');
      },
      'error-callback': () => {
        emit('update:modelValue', '');
        emit('error');
      },
    });
  } catch {
    emit('error');
  }
});

onBeforeUnmount(() => {
  if (widgetId && window.turnstile) {
    try { window.turnstile.remove(widgetId); } catch { /* Widget 可能已移除 */ }
    widgetId = null;
  }
});
</script>
