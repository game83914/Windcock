<template>
  <div>
    <button type="button" class="focus-ring border border-[#171717] bg-[#faf8f3] px-4 py-2 text-xs font-black" @click="open = !open">
      {{ open ? '收合 GIF 選擇器' : `＋ 加入 GIF（${modelValue.length}/${max}）` }}
    </button>
    <div v-if="open" class="mt-3 border-2 border-[#171717] bg-[#ebe6dc] p-4 shadow-[4px_4px_0_#171717]">
      <div class="flex flex-col gap-2 sm:flex-row">
        <input v-model.trim="search" placeholder="搜尋全部 GIF" class="focus-ring min-w-0 flex-1 border border-[#bfb8ad] bg-white px-3 py-2 text-sm" @keyup.enter="load" />
        <button type="button" class="focus-ring bg-[#171717] px-4 py-2 text-xs font-bold text-white" @click="load">搜尋</button>
        <NuxtLink to="/gifs" class="focus-ring px-3 py-2 text-center text-xs font-bold text-[#d84a36]">前往市集</NuxtLink>
      </div>
      <p v-if="error" class="mt-3 text-xs font-bold text-[#a63222]">{{ error }}</p>
      <div v-if="loading" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div v-for="n in 3" :key="n" class="h-40 animate-pulse bg-[#d7d1c6]" /></div>
      <div v-else-if="filtered.length" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <GifCard v-for="asset in filtered" :key="asset.id" :asset="asset" :linked="false" selectable :selected="modelValue.includes(asset.id)" @select="toggle(asset)" />
      </div>
      <p v-else class="mt-4 py-8 text-center text-xs text-[#77716a]">找不到可使用的 GIF。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GifAsset, GifListResponse } from '~/types/gif';

const props = withDefaults(defineProps<{ modelValue: string[]; max?: number }>(), { max: 1 });
const emit = defineEmits<{ 'update:modelValue': [ids: string[]]; change: [assets: GifAsset[]] }>();
const api = useApi();
const open = ref(false);
const loading = ref(false);
const loaded = ref(false);
const error = ref('');
const search = ref('');
const assets = ref<GifAsset[]>([]);
const filtered = computed(() => {
  const term = search.value.toLocaleLowerCase();
  return assets.value.filter((asset) => asset.usable && (!term || asset.title.toLocaleLowerCase().includes(term)));
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await api.get<GifListResponse>('/memes', { search: search.value || undefined, sort: 'POPULAR', limit: 50 });
    assets.value = result.items;
    loaded.value = true;
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    loading.value = false;
  }
}

function toggle(asset: GifAsset) {
  const ids = [...props.modelValue];
  const index = ids.indexOf(asset.id);
  if (index >= 0) ids.splice(index, 1);
  else if (ids.length < props.max) ids.push(asset.id);
  else if (props.max === 1) ids.splice(0, 1, asset.id);
  emit('update:modelValue', ids);
  emit('change', assets.value.filter((item) => ids.includes(item.id)));
}

watch(open, (value) => { if (value && !loaded.value) load(); });
</script>
