<template>
  <div class="mx-auto max-w-5xl pb-12">
    <AdminNav />
    <header class="border-b-2 border-[#171717] pb-6"><h1 class="text-3xl font-black tracking-[-0.04em]">GIF 管理台</h1></header>

    <details class="my-6 border border-[#d7d1c6] bg-[#faf8f3] p-5">
      <summary class="focus-ring cursor-pointer font-black">＋ 管理員上架 GIF</summary>
      <form class="mt-5 grid gap-3 sm:grid-cols-2" @submit.prevent="adminUpload">
        <input ref="fileInput" type="file" accept="image/gif" required class="focus-ring border border-[#bfb8ad] bg-white p-3 text-sm" @change="pickFile" />
        <input v-model.trim="title" required minlength="3" maxlength="100" placeholder="GIF 標題" class="focus-ring border border-[#bfb8ad] bg-white px-4 py-3 text-sm" />
        <input value="0" type="number" disabled aria-label="官方素材固定免費" class="border border-[#bfb8ad] bg-[#ebe6dc] px-4 py-3 text-sm" />
        <button class="focus-ring bg-[#171717] px-5 py-3 text-sm font-black text-white disabled:opacity-50" :disabled="uploading || !file">{{ uploading ? '上傳中…' : '直接上架' }}</button>
      </form>
    </details>

    <div class="mb-6 flex gap-2 overflow-x-auto"><button v-for="item in filters" :key="item.value" class="focus-ring shrink-0 border px-4 py-2 text-sm font-bold" :class="status === item.value ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#cfc8bc] bg-[#faf8f3]'" @click="status = item.value; load()">{{ item.label }}</button></div>
    <p v-if="notice" class="mb-5 bg-[#e5f1e9] p-4 text-sm text-[#3f7a58]">{{ notice }}</p>
    <p v-if="pageError" class="mb-5 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm text-[#8f3022]">{{ pageError }}</p>
    <div v-if="loading" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><div v-for="n in 3" :key="n" class="h-80 animate-pulse bg-[#e5e0d6]" /></div>
    <div v-else-if="items.length" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <GifCard v-for="asset in items" :key="asset.id" :asset="asset" :linked="asset.status === 'APPROVED'" show-status>
        <template #action><button class="focus-ring text-xs font-black text-[#3157d5]" @click="active = active === asset.id ? null : asset.id">處理</button></template>
      </GifCard>
      <div v-for="asset in items.filter((item) => active === item.id)" :key="`actions-${asset.id}`" class="border-2 border-[#171717] bg-[#ebe6dc] p-4 sm:col-span-2 lg:col-span-3">
        <p class="font-black">處理：{{ asset.title }}</p>
        <div v-if="asset.reports?.length" class="mt-3 border-l-4 border-[#d84a36] bg-[#faf8f3] p-3 text-xs">
          <strong>{{ asset.reports.length }} 筆待處理檢舉</strong>
          <p v-for="report in asset.reports" :key="report.id" class="mt-2 text-[#6d6861]">{{ report.reporter }} · {{ report.reason }}<span v-if="report.detail">：{{ report.detail }}</span></p>
        </div>
        <div class="mt-3 flex flex-col gap-3 sm:flex-row">
          <button v-if="asset.status === 'PENDING_REVIEW'" class="focus-ring bg-[#3f7a58] px-5 py-3 text-sm font-bold text-white" :disabled="working" @click="approve(asset.id)">核准</button>
          <input v-model.trim="reason" class="focus-ring min-w-0 flex-1 border border-[#bfb8ad] bg-white px-4 py-3 text-sm" :placeholder="asset.status === 'PENDING_REVIEW' ? '拒絕註記' : '下架原因'" />
          <button v-if="asset.status === 'PENDING_REVIEW'" class="focus-ring border border-[#d84a36] px-5 py-3 text-sm font-bold text-[#a63222]" :disabled="working || !reason" @click="reject(asset.id)">拒絕</button>
          <button v-else-if="asset.status === 'APPROVED'" class="focus-ring bg-[#d84a36] px-5 py-3 text-sm font-bold text-white" :disabled="working || !reason" @click="takedown(asset.id)">下架</button>
        </div>
      </div>
    </div>
    <p v-else class="border border-[#d7d1c6] bg-[#faf8f3] py-16 text-center text-sm text-[#77716a]">此狀態目前沒有 GIF。</p>
  </div>
</template>

<script setup lang="ts">
import type { GifAsset, GifListResponse } from '~/types/gif';

definePageMeta({ middleware: ['auth', 'admin'] });
useSeoMeta({ title: 'GIF 管理台｜輿論測風向' });
const api = useApi();
const filters = [{ label: '待複核', value: 'PENDING_REVIEW' }, { label: '已核准', value: 'APPROVED' }, { label: '已拒絕', value: 'REJECTED' }, { label: '已下架', value: 'TAKEN_DOWN' }];
const status = ref('PENDING_REVIEW');
const items = ref<GifAsset[]>([]);
const loading = ref(true);
const working = ref(false);
const uploading = ref(false);
const pageError = ref('');
const notice = ref('');
const active = ref<string | null>(null);
const reason = ref('');
const file = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const title = ref('');

async function load() { loading.value = true; pageError.value = ''; try { items.value = (await api.get<GifListResponse>('/admin/memes', { status: status.value })).items; } catch (error) { pageError.value = errorMessage(error); } finally { loading.value = false; } }
async function act(request: () => Promise<unknown>, success: string) { working.value = true; pageError.value = ''; notice.value = ''; try { await request(); notice.value = success; active.value = null; reason.value = ''; await load(); } catch (error) { pageError.value = errorMessage(error); } finally { working.value = false; } }
function approve(id: string) { return act(() => api.post(`/admin/memes/${id}/approve`, {}), 'GIF 已核准上架。'); }
function reject(id: string) { return act(() => api.post(`/admin/memes/${id}/reject`, { note: reason.value }), 'GIF 已拒絕。'); }
function takedown(id: string) { return act(() => api.post(`/admin/memes/${id}/takedown`, { reason: reason.value }), 'GIF 已下架。'); }
function pickFile(event: Event) { file.value = (event.target as HTMLInputElement).files?.[0] || null; }
async function adminUpload() {
  if (!file.value) return;
  uploading.value = true; pageError.value = ''; notice.value = '';
  const form = new FormData(); form.append('file', file.value); form.append('title', title.value);
  try { await api.post('/admin/memes/upload', form, { timeout: 120000 }); notice.value = '管理員免費 GIF 已上架。'; file.value = null; title.value = ''; if (fileInput.value) fileInput.value.value = ''; status.value = 'APPROVED'; await load(); } catch (error) { pageError.value = errorMessage(error); } finally { uploading.value = false; }
}
onMounted(load);
</script>
