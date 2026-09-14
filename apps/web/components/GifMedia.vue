<template>
  <div class="relative overflow-hidden bg-[#e5e0d6]" :style="aspectStyle">
    <img
      v-if="source && !failed"
      :src="source"
      :alt="alt || asset.title"
      :loading="eager ? 'eager' : 'lazy'"
      class="h-full w-full object-cover"
      @error="failed = true"
    />
    <div v-else class="grid h-full min-h-28 place-items-center p-4 text-center text-xs font-bold text-[#77716a]">
      {{ placeholder }}
    </div>
    <span v-if="asset.frameCount" class="absolute bottom-2 right-2 bg-[#171717]/80 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white">GIF · {{ duration }}</span>
  </div>
</template>

<script setup lang="ts">
import type { GifAsset } from '~/types/gif';

const props = withDefaults(defineProps<{ asset: GifAsset; alt?: string; eager?: boolean; posterOnly?: boolean }>(), {
  alt: '',
  eager: false,
  posterOnly: false,
});
const api = useApi();
const failed = ref(false);
const privatePreview = ref('');
const reducedMotion = ref(true);
const source = computed(() => privatePreview.value || (props.posterOnly || reducedMotion.value ? props.asset.posterUrl : (props.asset.previewUrl || props.asset.posterUrl)));
const aspectStyle = computed(() => ({ aspectRatio: `${props.asset.width || 4} / ${props.asset.height || 3}` }));
const duration = computed(() => `${Math.max(0, props.asset.durationMs / 1000).toFixed(1)}s`);
const placeholder = computed(() => props.asset.status === 'TAKEN_DOWN'
  ? '此 GIF 已下架'
  : props.asset.status === 'REJECTED'
    ? '此 GIF 未通過複核'
    : props.asset.status === 'APPROVED'
      ? 'GIF 預覽暫時無法載入'
      : '預覽將在複核通過後開放');

async function loadPrivatePreview() {
  const endpoint = reducedMotion.value ? props.asset.reviewPosterUrl : props.asset.reviewPreviewUrl;
  if (!import.meta.client || props.asset.previewUrl || !endpoint) return;
  if (privatePreview.value) URL.revokeObjectURL(privatePreview.value);
  try {
    const blob = await api.getBlob(endpoint);
    privatePreview.value = URL.createObjectURL(blob);
  } catch {
    failed.value = true;
  }
}

watch(() => props.asset.id, () => { failed.value = false; loadPrivatePreview(); });
let motionQuery: MediaQueryList | null = null;
function syncMotionPreference(event?: MediaQueryListEvent) {
  reducedMotion.value = event?.matches ?? motionQuery?.matches ?? false;
  if (event && !props.asset.previewUrl) loadPrivatePreview();
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  syncMotionPreference();
  motionQuery.addEventListener('change', syncMotionPreference);
  loadPrivatePreview();
});
onUnmounted(() => {
  if (privatePreview.value) URL.revokeObjectURL(privatePreview.value);
  motionQuery?.removeEventListener('change', syncMotionPreference);
});
</script>
