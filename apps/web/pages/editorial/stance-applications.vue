<template>
  <section class="mx-auto max-w-5xl pb-12">
    <header class="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#171717] pb-5">
      <div>
        <p class="eyebrow text-[#3157d5]">議題小組</p>
        <h1 class="mt-1 text-3xl font-black tracking-[-0.04em]">立場提案工作台</h1>
        <p class="mt-2 text-sm text-[#6d6861]">議題小組可檢視、整理、退回與發布；開始審閱後，會員會暫停修改。</p>
      </div>
      <select v-model="status" class="focus-ring min-h-11 border border-[#171717] bg-white px-4 text-sm font-bold" @change="changeStatus">
        <option value="">全部狀態</option>
        <option value="PENDING">已送出 · 會員可修改</option>
        <option value="IN_REVIEW">審閱中 · 會員已鎖定</option>
        <option value="APPROVED">已轉為正式立場</option>
        <option value="REJECTED">已退回修改</option>
      </select>
    </header>

    <p v-if="notice" role="status" class="mt-5 border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-4 text-sm font-bold text-[#2f6547]">{{ notice }}</p>
    <p v-if="error" role="alert" class="mt-5 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm font-bold text-[#a63222]">{{ error }}</p>
    <section v-if="selectedItems.length" class="mt-5 border-2 border-[#3157d5] bg-[#e7ecff] p-5">
      <div class="flex flex-wrap items-center justify-between gap-3"><strong>{{ selectedItems.length }} 筆來源提案</strong><button v-if="!outputs.length" type="button" class="min-h-10 bg-[#3157d5] px-4 text-xs font-black text-white" @click="startResolution">建立整併／劃分正式稿</button></div>
      <p v-if="mixedSourceLocations" class="mt-3 border-l-4 border-[#9a5b12] bg-[#fff0d7] p-3 text-xs font-bold text-[#78470e]">來源提案來自不同回應位置，發布前請為每個正式立場重新確認放置位置。</p>
      <form v-if="outputs.length" class="mt-4 grid gap-4" @submit.prevent="resolveSelected">
        <fieldset v-for="(output, index) in outputs" :key="index" class="grid gap-3 border border-[#3157d5] bg-white p-4">
          <legend class="px-2 text-xs font-black">正式立場 {{ index + 1 }}</legend>
          <div class="grid gap-2"><label v-for="item in selectedItems" :key="item.id" class="flex items-start gap-2 text-xs"><input v-model="output.applicationIds" type="checkbox" :value="item.id" class="mt-0.5" /><span><strong>{{ item.submitter?.nickname }}：{{ item.title }}</strong><small class="mt-0.5 block text-[#77716a]">{{ targetPath(item) }}</small></span></label></div>
          <input v-model="output.title" maxlength="80" placeholder="正式立場名稱" class="focus-ring min-h-11 border border-[#bfb8ad] px-3 text-sm font-bold" />
          <textarea v-model="output.rationale" maxlength="200" rows="2" placeholder="正式理由說明" class="focus-ring border border-[#bfb8ad] p-3 text-sm" />
          <label class="text-xs font-black">發布位置
            <select v-model="output.parentStanceId" class="focus-ring mt-1 min-h-11 w-full border border-[#bfb8ad] bg-white px-3 text-sm"><option value="">直接回應議題</option><option v-for="option in stanceOptions" :key="option.id" :value="option.id">{{ option.path }}</option></select>
          </label>
          <p class="bg-[#f4f1ea] p-3 text-xs"><strong>確認位置：</strong>{{ outputPlacement(output) }}</p>
          <button v-if="outputs.length > 1" type="button" class="justify-self-end text-xs font-black text-[#a63222]" @click="outputs.splice(index, 1)">移除此輸出</button>
        </fieldset>
        <label class="text-xs font-black">給提案者的整理說明（選填）<textarea v-model="resolutionReviewNote" maxlength="500" rows="2" class="focus-ring mt-1 w-full border border-[#bfb8ad] bg-white p-3 text-sm" /></label>
        <div class="flex flex-wrap justify-end gap-2"><button type="button" class="min-h-10 border border-[#3157d5] px-4 text-xs font-black" @click="addOutput">＋ 再劃分一個正式立場</button><button class="min-h-10 bg-[#171717] px-5 text-xs font-black text-white disabled:opacity-40" :disabled="resolving || outputs.some((output) => output.applicationIds.length === 0 || output.title.trim().length < 2)">{{ resolving ? '發布中…' : '確認位置並發布全部' }}</button></div>
      </form>
    </section>
    <div v-if="loading" class="mt-6 h-56 animate-pulse bg-[#e5e0d6]" />
    <p v-else-if="!items.length" class="mt-6 border border-dashed border-[#bfb8ad] p-12 text-center text-sm text-[#6d6861]">此篩選目前沒有立場提案。</p>
    <div v-else class="mt-6 grid gap-5">
      <article v-for="item in items" :key="item.id" class="border-2 border-[#171717] bg-[#faf8f3] p-5 shadow-[5px_5px_0_#d7d1c6] sm:p-6">
        <label v-if="editable(item)" class="mb-3 flex items-center gap-2 text-xs font-black"><input v-model="selectedIds" type="checkbox" :value="item.id" :disabled="selectedItems.length > 0 && selectedItems[0]?.topicId !== item.topicId && !selectedIds.includes(item.id)" />納入多來源整理</label>
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="bg-[#171717] px-2 py-1 font-black text-white">{{ statusLabel(item.status) }}</span>
          <span class="text-[#77716a]">{{ item.submitter?.nickname }} · {{ formatLocaleDateTime(item.createdAt) }}</span>
        </div>
        <div class="mt-3 border-l-4 border-[#3157d5] bg-[#e7ecff] p-3 text-xs"><NuxtLink :to="`/topic/${item.topicId}?section=stances${item.parentStanceId ? `&stance=${item.parentStanceId}` : ''}`" class="focus-ring font-black text-[#3157d5]">議題：{{ item.target.topic.title }}</NuxtLink><p class="mt-1 text-[#5f5a53]">回應位置：{{ targetPath(item) }}</p></div>

        <div v-if="canEdit(item) && editable(item)" class="mt-4 grid gap-3">
          <label class="text-xs font-black">立場名稱
            <input v-model.trim="item.title" maxlength="80" class="focus-ring mt-1 min-h-11 w-full border border-[#bfb8ad] bg-white px-3 text-sm" />
          </label>
          <label class="text-xs font-black">理由說明
            <textarea v-model.trim="item.rationale" maxlength="200" rows="3" class="focus-ring mt-1 w-full border border-[#bfb8ad] bg-white p-3 text-sm" />
          </label>
          <label class="text-xs font-black">審核備註
            <textarea v-model.trim="item.reviewNote" maxlength="500" rows="2" placeholder="未採用時至少填寫 5 個字" class="focus-ring mt-1 w-full border border-[#bfb8ad] bg-white p-3 text-sm" />
          </label>
        </div>
        <div v-else class="mt-4">
          <h2 class="text-xl font-black">{{ item.title }}</h2>
          <p v-if="item.rationale" class="mt-2 text-sm leading-6 text-[#6d6861]">{{ item.rationale }}</p>
          <p v-if="item.reviewNote" class="mt-2 text-xs text-[#a63222]">{{ item.reviewNote }}</p>
        </div>
        <p v-if="item.note" class="mt-3 bg-white p-3 text-xs text-[#5f5a53]"><strong>提案者給小組的補充：</strong>{{ item.note }}</p>

        <div v-if="editable(item)" class="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#d7d1c6] pt-4">
          <button v-if="canEdit(item)" type="button" class="focus-ring min-h-10 border border-[#171717] px-4 text-xs font-black" :disabled="working === item.id" @click="save(item)">儲存文字</button>
          <button v-if="canEdit(item) && item.status === 'PENDING'" type="button" class="focus-ring min-h-10 border border-[#3157d5] px-4 text-xs font-black text-[#3157d5]" :disabled="working === item.id" @click="startReview(item)">開始審閱並鎖定修改</button>
          <button v-if="canEdit(item)" type="button" class="focus-ring min-h-10 border border-[#d84a36] px-4 text-xs font-black text-[#a63222] disabled:opacity-40" :disabled="working === item.id || (item.reviewNote?.trim().length || 0) < 5" @click="reject(item)">未採用</button>
          <button v-if="canPublish(item)" type="button" class="focus-ring min-h-10 bg-[#3157d5] px-5 text-xs font-black text-white disabled:opacity-40" :disabled="working === item.id || item.title.trim().length < 2" @click="publish(item)">發布立場</button>
        </div>
        <div v-if="item.results.length" class="mt-4 flex flex-wrap gap-3"><NuxtLink v-for="result in item.results" :key="result.stanceId" :to="`/topic/${item.topicId}?section=stances&stance=${result.stanceId}`" class="focus-ring text-sm font-black text-[#3157d5]">{{ result.stance.title }} &rarr;</NuxtLink></div>
      </article>
    </div>
    <div v-if="total > 20" class="mt-6 flex items-center justify-between text-sm font-bold">
      <button type="button" class="focus-ring border border-[#171717] px-4 py-2 disabled:opacity-30" :disabled="page === 1" @click="changePage(page - 1)">&larr; 上一頁</button>
      <span>第 {{ page }} / {{ Math.ceil(total / 20) }} 頁</span>
      <button type="button" class="focus-ring border border-[#171717] px-4 py-2 disabled:opacity-30" :disabled="page * 20 >= total" @click="changePage(page + 1)">下一頁 &rarr;</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { StanceApplication } from '~/types/application';
import type { StanceNode, StanceTreeResponse } from '~/types/topic';
import { formatLocaleDateTime } from '~/utils/format';
definePageMeta({ middleware: 'editorial' });
useSeoMeta({ title: '立場提案工作台｜輿論測風向' });
const api = useApi();
const auth = useAuthStore();
const items = ref<StanceApplication[]>([]);
const status = ref('PENDING');
const loading = ref(true);
const working = ref('');
const error = ref('');
const notice = ref('');
const page = ref(1);
const total = ref(0);
const selectedIds = ref<string[]>([]);
const outputs = ref<Array<{ applicationIds: string[]; title: string; rationale: string; parentStanceId: string }>>([]);
const resolving = ref(false);
const resolutionReviewNote = ref('');
const stanceOptions = ref<Array<{ id: string; path: string }>>([]);
const selectedItems = computed(() => items.value.filter((item) => selectedIds.value.includes(item.id)));
const mixedSourceLocations = computed(() => new Set(selectedItems.value.map((item) => item.parentStanceId || 'TOPIC')).size > 1);
const labels: Record<string, string> = { PENDING: '已送出 · 會員可修改', IN_REVIEW: '審閱中 · 會員已鎖定', APPROVED: '已轉為正式立場', REJECTED: '已退回修改', WITHDRAWN: '已撤回' };
const statusLabel = (value: string) => labels[value] || value;
const editable = (item: StanceApplication) => item.status === 'PENDING' || item.status === 'IN_REVIEW';
function hasScopedRole(item: StanceApplication, roles: string[]) {
  if (auth.role === 'ADMIN') return true;
  return (auth.capabilitySummary?.assignments ?? []).some((assignment) => roles.includes(assignment.role) && (
    assignment.scope === 'GLOBAL' ||
    (assignment.scope === 'TOPIC' && assignment.topicId === item.topicId)
  ));
}
const canEdit = (item: StanceApplication) => hasScopedRole(item, ['TOPIC_TEAM']);
const canPublish = (item: StanceApplication) => hasScopedRole(item, ['TOPIC_TEAM']);

async function load() {
  loading.value = true; error.value = '';
  try {
    const result = await api.get<{ items: StanceApplication[]; pagination: { total: number } }>('/editorial/stance-applications', { status: status.value || undefined, page: page.value, limit: 20 });
    items.value = result.items; total.value = result.pagination.total;
  }
  catch (cause) { error.value = errorMessage(cause); }
  finally { loading.value = false; }
}
function resetSelection() { selectedIds.value = []; outputs.value = []; resolutionReviewNote.value = ''; stanceOptions.value = []; }
function changeStatus() { page.value = 1; resetSelection(); load(); }
function changePage(value: number) { page.value = value; resetSelection(); load(); }
async function startResolution() {
  const first = selectedItems.value[0];
  if (!first) return;
  try {
    const tree = await api.get<StanceTreeResponse>(`/topics/${first.topicId}/stances`);
    stanceOptions.value = flattenStanceOptions(tree.roots);
  } catch (cause) { error.value = errorMessage(cause); return; }
  outputs.value = [{ applicationIds: [...selectedIds.value], title: first.title, rationale: first.rationale || '', parentStanceId: first.parentStanceId || '' }];
}
function addOutput() { outputs.value.push({ applicationIds: [...selectedIds.value], title: '', rationale: '', parentStanceId: selectedItems.value[0]?.parentStanceId || '' }); }
async function resolveSelected() {
  resolving.value = true; error.value = ''; notice.value = '';
  try {
    await api.post('/editorial/stance-resolutions', {
      outputs: outputs.value.map((output) => ({ ...output, parentStanceId: output.parentStanceId || undefined, rationale: output.rationale || undefined })),
      reviewNote: resolutionReviewNote.value || undefined,
      expectedUpdatedAt: Object.fromEntries(selectedItems.value.map((item) => [item.id, item.updatedAt])),
    });
    notice.value = `已發布 ${outputs.value.length} 個正式立場。`; resetSelection(); await load();
  } catch (cause) { error.value = errorMessage(cause); }
  finally { resolving.value = false; }
}

async function save(item: StanceApplication) {
  await update(item, { title: item.title, rationale: item.rationale || undefined, reviewNote: item.reviewNote || undefined, expectedUpdatedAt: item.updatedAt }, '整理文字已儲存，提案狀態未改變。');
}
async function startReview(item: StanceApplication) {
  await update(item, { status: 'IN_REVIEW', title: item.title, rationale: item.rationale || undefined, reviewNote: item.reviewNote || undefined, expectedUpdatedAt: item.updatedAt }, '已開始審閱，會員暫時無法修改。');
}
async function reject(item: StanceApplication) {
  await update(item, { status: 'REJECTED', title: item.title, rationale: item.rationale || undefined, reviewNote: item.reviewNote, expectedUpdatedAt: item.updatedAt }, '提案已退回，會員可修改後重新送審。');
}
async function update(item: StanceApplication, body: Record<string, unknown>, message: string) {
  working.value = item.id; error.value = ''; notice.value = '';
  try { await api.patch(`/editorial/stance-applications/${item.id}`, body); notice.value = message; await load(); }
  catch (cause) { error.value = errorMessage(cause); }
  finally { working.value = ''; }
}
async function publish(item: StanceApplication) {
  working.value = item.id; error.value = ''; notice.value = '';
  try {
    await api.post(`/editorial/stance-applications/${item.id}/publish`, { title: item.title, rationale: item.rationale || undefined, reviewNote: item.reviewNote || undefined, expectedUpdatedAt: item.updatedAt });
    notice.value = '立場已發布到公開立場樹。'; await load();
  } catch (cause) { error.value = errorMessage(cause); }
  finally { working.value = ''; }
}
function targetPath(item: StanceApplication) { return item.target.kind === 'TOPIC' ? '直接回應議題' : `${item.target.path.map((node) => node.title).join(' / ')}之下`; }
function flattenStanceOptions(nodes: StanceNode[], ancestors: string[] = []): Array<{ id: string; path: string }> {
  return nodes.flatMap((node) => {
    const path = [...ancestors, node.title];
    return [{ id: node.id, path: path.join(' / ') }, ...flattenStanceOptions(node.children, path)];
  });
}
function outputPlacement(output: { parentStanceId: string }) {
  const topicTitle = selectedItems.value[0]?.target.topic.title || '';
  if (!output.parentStanceId) return `${topicTitle} / 新立場`;
  return `${topicTitle} / ${stanceOptions.value.find((option) => option.id === output.parentStanceId)?.path || '未知位置'} / 新衍生立場`;
}
onMounted(load);
</script>
