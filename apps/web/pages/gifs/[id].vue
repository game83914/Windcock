<template>
  <div class="mx-auto max-w-5xl pb-12">
    <NuxtLink to="/gifs" class="focus-ring text-sm font-bold text-[#6d6861]">&larr; 返回 GIF 市集</NuxtLink>
    <p v-if="pageError && !asset" class="mt-6 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm">{{ pageError }}</p>
    <div v-if="loading" class="mt-5 h-[32rem] animate-pulse bg-[#e5e0d6]" />
    <div v-else-if="asset" class="mt-5 grid gap-7 md:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <div class="border-2 border-[#171717] bg-[#171717] p-2"><GifMedia :asset="asset" eager /></div>
      <section class="flex flex-col border-t-4 border-[#d84a36] bg-[#faf8f3] p-6">
        <p class="eyebrow text-[#77716a]">GIF #{{ asset.id }}</p>
        <h1 class="mt-3 text-3xl font-black tracking-[-0.04em]">{{ asset.title }}</h1>
        <p class="mt-3 flex items-center gap-2 text-sm text-[#6d6861]"><UserAvatar :nickname="asset.creator.nickname" :avatar-url="asset.creator.avatarUrl" size="sm" />{{ asset.creator.nickname }} · 已使用 {{ asset.usageCount }} 次</p>
        <dl class="mt-7 grid grid-cols-2 gap-px bg-[#d7d1c6] text-xs">
          <div class="bg-[#ebe6dc] p-3"><dt class="text-[#77716a]">尺寸</dt><dd class="mt-1 font-black">{{ asset.width }} × {{ asset.height }}</dd></div>
          <div class="bg-[#ebe6dc] p-3"><dt class="text-[#77716a]">影格</dt><dd class="mt-1 font-black">{{ asset.frameCount }}</dd></div>
        </dl>
        <div class="mt-auto pt-8">
          <p class="text-2xl font-black text-[#3f7a58]">免費直接使用</p>
          <p class="mt-2 text-xs leading-5 text-[#77716a]">不必收藏即可從貼文、留言或議題編輯器搜尋使用；合格使用會回饋創作者 1 點。</p>
          <button class="focus-ring mt-3 w-full border-2 px-5 py-4 text-sm font-black disabled:opacity-50" :class="asset.collected ? 'border-[#3f7a58] bg-[#e5f1e9] text-[#3f7a58]' : 'border-[#171717]'" :disabled="collecting" @click="toggleCollection">{{ collecting ? '處理中…' : asset.collected ? '已收藏，點此取消' : auth.isAuthed ? '加入我的最愛' : '登入後加入最愛' }}</button>
          <button v-if="!asset.isCreator && auth.canReport" class="focus-ring mt-4 w-full text-xs font-bold text-[#77716a] hover:text-[#a63222]" @click="reportOpen = !reportOpen">{{ reportOpen ? '取消檢舉' : '檢舉此 GIF' }}</button>
          <p v-else-if="auth.isAuthed && !auth.canReport" class="mt-4 text-center text-xs text-[#77716a]">檢舉功能限資深一般會員</p>
          <form v-if="reportOpen && auth.canReport" class="mt-3 space-y-3 border border-[#d7d1c6] bg-[#ebe6dc] p-3" @submit.prevent="report">
            <label class="block text-xs font-bold">原因
              <select v-model="reportReason" class="focus-ring mt-1 w-full border border-[#bfb8ad] bg-white px-3 py-2 text-sm">
                <option value="COPYRIGHT">疑似侵權</option>
                <option value="INAPPROPRIATE">不當內容</option>
                <option value="OTHER">其他</option>
              </select>
            </label>
            <textarea v-model.trim="reportDetail" maxlength="500" rows="3" placeholder="補充說明（選填）" class="focus-ring w-full border border-[#bfb8ad] bg-white p-3 text-sm" />
            <button class="focus-ring w-full bg-[#171717] px-4 py-2 text-xs font-black text-white disabled:opacity-50" :disabled="reporting">{{ reporting ? '送出中…' : '送出檢舉' }}</button>
          </form>
          <p v-if="notice" class="mt-4 bg-[#ebe6dc] p-3 text-sm">{{ notice }}</p>
          <p v-if="pageError" class="mt-4 bg-[#fbe9e5] p-3 text-sm text-[#8f3022]">{{ pageError }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GifAsset, GifCollectionResponse } from '~/types/gif';

const route = useRoute();
const api = useApi();
const auth = useAuthStore();
const id = computed(() => String(route.params.id));
const asset = ref<GifAsset | null>(null);
const loading = ref(true);
const collecting = ref(false);
const pageError = ref('');
const notice = ref('');
const reportOpen = ref(false);
const reporting = ref(false);
const reportReason = ref<'COPYRIGHT' | 'INAPPROPRIATE' | 'OTHER'>('INAPPROPRIATE');
const reportDetail = ref('');
useSeoMeta({ title: computed(() => asset.value ? `${asset.value.title}｜GIF 市集` : 'GIF 市集｜輿論測風向') });

async function load() {
  loading.value = true;
  pageError.value = '';
  asset.value = null;
  const expectedId = id.value;
  try {
    const fresh = await api.get<GifAsset>(`/memes/${expectedId}`);
    if (id.value === expectedId) asset.value = fresh;
  }
  catch (error) {
    if (id.value === expectedId) pageError.value = errorMessage(error);
  }
  finally {
    if (id.value === expectedId) loading.value = false;
  }
}
async function toggleCollection() {
  if (!auth.isAuthed) return navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`);
  if (!asset.value) return;
  collecting.value = true; pageError.value = ''; notice.value = '';
  try {
    const result = asset.value.collected
      ? await api.delete<GifCollectionResponse>(`/memes/${id.value}/collection`)
      : await api.post<GifCollectionResponse>(`/memes/${id.value}/collection`, {});
    asset.value = result.meme;
    notice.value = result.meme.collected ? '已加入我的最愛。' : '已取消收藏。';
  } catch (error) { pageError.value = errorMessage(error); }
  finally { collecting.value = false; }
}
async function report() {
  if (!auth.isAuthed) return navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`);
  pageError.value = ''; notice.value = '';
  reporting.value = true;
  try { await api.post(`/memes/${id.value}/report`, { reason: reportReason.value, detail: reportDetail.value || undefined }); notice.value = '已收到檢舉，管理團隊會進行審查。'; reportOpen.value = false; }
  catch (error) { pageError.value = errorMessage(error); }
  finally { reporting.value = false; }
}
onMounted(load);
watch(id, () => {
  notice.value = '';
  reportOpen.value = false;
  load();
});
</script>
