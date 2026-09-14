<template>
  <div class="pb-12">
    <header class="border-b-2 border-[#171717] pb-6"><h1 class="text-3xl font-black tracking-[-0.04em]">我的 GIF</h1></header>
    <nav class="my-6 flex gap-2 overflow-x-auto">
      <button v-for="item in tabs" :key="item.value" class="focus-ring shrink-0 border px-5 py-2.5 text-sm font-black" :class="tab === item.value ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#cfc8bc] bg-[#faf8f3]'" @click="setTab(item.value)">{{ item.label }}</button>
    </nav>

    <section v-if="tab === 'upload'" class="grid gap-7 lg:grid-cols-[1fr_0.7fr]">
      <form class="border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:p-7" @submit.prevent="upload">
        <h2 class="text-xl font-black">投稿 GIF</h2>
        <p class="mt-2 text-sm leading-6 text-[#6d6861]">投稿會先進入平台複核；通過前不會在市集公開。</p>
        <div class="mt-6 space-y-5">
          <label class="block"><span class="mb-2 block text-sm font-bold">GIF 檔案</span><input ref="fileInput" type="file" accept="image/gif" required class="focus-ring block w-full border border-[#bfb8ad] bg-white p-3 text-sm" @change="pickFile" /></label>
          <label class="block"><span class="mb-2 block text-sm font-bold">標題</span><input v-model.trim="title" minlength="3" maxlength="100" required class="focus-ring w-full border border-[#bfb8ad] bg-white px-4 py-3 text-sm" /></label>
          <p class="border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-4 text-sm leading-6 text-[#2f6547]">GIF 通過複核後，所有會員都能免費使用。其他會員每次合格使用可讓你獲得 1 點，每日最多 50 點。</p>
          <label class="flex cursor-pointer items-start gap-3 bg-[#ebe6dc] p-4 text-sm leading-6"><input v-model="rightsAttested" type="checkbox" required class="mt-1 accent-[#d84a36]" /><span>我確認擁有此內容的使用及散布權利，且內容不侵害他人權益。</span></label>
        </div>
        <p v-if="message" class="mt-5 p-3 text-sm" :class="uploadError ? 'bg-[#fbe9e5] text-[#8f3022]' : 'bg-[#e5f1e9] text-[#3f7a58]'">{{ message }}</p>
        <button class="focus-ring mt-5 w-full bg-[#d84a36] px-5 py-4 text-sm font-black text-white disabled:opacity-50" :disabled="uploading || !file || !rightsAttested">{{ uploading ? '上傳處理中，請勿關閉頁面…' : '送交複核' }}</button>
      </form>
      <aside class="border-l-4 border-[#3157d5] bg-[#e7ecff] p-6 text-sm leading-7 text-[#4c5265]"><h2 class="font-black text-[#171717]">投稿提醒</h2><p class="mt-3">請勿上傳偷拍、仇恨、暴力、色情、侵權或包含個人資料的內容。管理員可拒絕或下架不適合公共討論的 GIF。</p></aside>
    </section>

    <section v-else>
      <p v-if="pageError" class="mb-5 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm">{{ pageError }}</p>
      <div v-if="loading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"><div v-for="n in 4" :key="n" class="h-64 animate-pulse bg-[#e5e0d6]" /></div>
      <div v-else-if="items.length" class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"><GifCard v-for="asset in items" :key="asset.id" :asset="asset" :linked="asset.status === 'APPROVED'" :show-status="tab === 'created'" /></div>
      <p v-else class="border border-[#d7d1c6] bg-[#faf8f3] py-20 text-center text-sm text-[#77716a]">{{ tab === 'collected' ? '尚未收藏 GIF。' : '尚未投稿 GIF。' }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { GifAsset, GifListResponse } from '~/types/gif';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '我的 GIF｜輿論測風向' });
const route = useRoute();
const router = useRouter();
const api = useApi();
const tabs = [{ label: '已收藏', value: 'collected' }, { label: '我的投稿', value: 'created' }, { label: '投稿 GIF', value: 'upload' }] as const;
type Tab = typeof tabs[number]['value'];
const initialTab = ['collected', 'created', 'upload'].includes(String(route.query.tab)) ? String(route.query.tab) as Tab : 'collected';
const tab = ref<Tab>(initialTab);
const items = ref<GifAsset[]>([]);
const loading = ref(false);
const pageError = ref('');
const file = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const title = ref('');
const rightsAttested = ref(false);
const uploading = ref(false);
const uploadError = ref(false);
const message = ref('');

async function load() {
  if (tab.value === 'upload') return;
  loading.value = true; pageError.value = '';
  try { items.value = (await api.get<GifListResponse>('/me/memes', { scope: tab.value })).items; }
  catch (error) { pageError.value = errorMessage(error); }
  finally { loading.value = false; }
}
function setTab(value: Tab) { tab.value = value; router.replace({ query: value === 'collected' ? {} : { tab: value } }); load(); }
function pickFile(event: Event) { file.value = (event.target as HTMLInputElement).files?.[0] || null; }
async function upload() {
  if (!file.value || !rightsAttested.value) return;
  uploading.value = true; message.value = ''; uploadError.value = false;
  const form = new FormData();
  form.append('file', file.value); form.append('title', title.value); form.append('rightsAttested', String(rightsAttested.value));
  try {
    await api.post('/memes/upload', form, { timeout: 120000 });
    message.value = '上傳完成，GIF 已送交平台複核。'; title.value = ''; rightsAttested.value = false; file.value = null;
    if (fileInput.value) fileInput.value.value = '';
  } catch (error) { uploadError.value = true; message.value = errorMessage(error); }
  finally { uploading.value = false; }
}
onMounted(load);
</script>
