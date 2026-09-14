<template>
  <section>
    <div class="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[#171717] pb-4">
      <div><p class="eyebrow text-[#3157d5]">提案紀錄</p><h2 class="mt-1 text-2xl font-black">我的提案</h2></div>
      <NuxtLink v-if="activeType === 'topic' && (auth.canSubmitTopicApplication || auth.canAuthorTopics)" to="/topics/create" class="focus-ring bg-[#d84a36] px-4 py-2.5 text-sm font-black text-white">提出新構想</NuxtLink>
    </div>

    <div class="mt-5 grid grid-cols-2 border-2 border-[#171717]" role="tablist" aria-label="提案類型">
      <button v-for="tab in tabs" :id="`${tab.value}-proposal-tab`" :key="tab.value" type="button" role="tab" class="focus-ring min-h-12 px-4 text-sm font-black" :class="activeType === tab.value ? 'bg-[#171717] text-white' : 'bg-[#faf8f3] text-[#5f5a53]'" :aria-selected="activeType === tab.value" :aria-controls="`${tab.value}-proposal-panel`" @click="setType(tab.value)">{{ tab.label }}</button>
    </div>

    <div v-if="activeType === 'topic'" id="topic-proposal-panel" role="tabpanel" aria-labelledby="topic-proposal-tab">
      <p v-if="topicError" role="alert" class="mt-4 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm text-[#a63222]">{{ topicError }}</p>
      <div v-if="topicLoading" class="mt-5 h-40 animate-pulse bg-[#e5e0d6]" />
      <div v-else-if="!topicItems.length" class="mt-5 border border-dashed border-[#bfb8ad] p-8 text-center text-sm text-[#6d6861]">尚未提交議題提案。</div>
      <div v-else class="mt-5 divide-y divide-[#d7d1c6] border-y border-[#171717] bg-[#faf8f3]">
        <article v-for="item in topicItems" :key="item.id" class="p-5">
          <div class="flex flex-wrap items-center gap-2 text-xs"><span class="font-black text-[#3157d5]">{{ topicStatusLabel(item.status) }}</span><span v-if="item.organization" class="bg-[#ebe6dc] px-2 py-1">{{ item.organization.name }}</span><time class="text-[#77716a]">{{ formatTime(item.createdAt) }}</time></div>
          <form v-if="topicEditingId === item.id" class="mt-3 grid gap-3 border border-dashed border-[#8f8980] bg-white p-4" @submit.prevent="saveTopic(item)">
            <input v-model="topicDraft.title" maxlength="100" class="focus-ring min-h-11 border border-[#bfb8ad] px-3 font-bold" aria-label="議題名稱" />
            <textarea v-model="topicDraft.description" maxlength="500" rows="3" class="focus-ring border border-[#bfb8ad] p-3 text-sm" aria-label="議題說明" />
            <select v-model="topicDraft.category" class="focus-ring min-h-11 border border-[#bfb8ad] px-3 text-sm" aria-label="議題分類"><option v-for="category in categories" :key="category.key" :value="category.key">{{ getCategoryMeta(category.key).label }}</option></select>
            <textarea v-model="topicDraft.note" maxlength="500" rows="2" class="focus-ring border border-[#bfb8ad] p-3 text-sm" aria-label="給議題小組的備註" />
            <div class="flex justify-end gap-2"><button type="button" class="focus-ring px-3 text-sm" @click="topicEditingId = ''">取消</button><button class="focus-ring min-h-10 bg-[#3157d5] px-4 text-sm font-black text-white">{{ item.status === 'REJECTED' ? '修改並重新送審' : '儲存修改' }}</button></div>
          </form>
          <template v-else><h3 class="mt-2 text-lg font-black">{{ item.title }}</h3><p v-if="item.note" class="mt-2 text-sm text-[#6d6861]">{{ item.note }}</p></template>
          <div class="mt-3 flex flex-wrap gap-3"><button v-if="['PENDING', 'REJECTED'].includes(item.status) && topicEditingId !== item.id" type="button" class="focus-ring text-sm font-black text-[#3157d5]" @click="startTopicEdit(item)">編輯提案</button><button type="button" class="focus-ring text-sm font-black text-[#6d6861]" @click="toggleTopicRevisions(item)">修訂紀錄</button></div>
          <div v-if="item.results.length" class="mt-3 flex flex-wrap gap-3"><NuxtLink v-for="result in item.results" :key="result.topicId" :to="`/topic/${result.topicId}`" class="focus-ring text-sm font-black text-[#3157d5]">{{ result.topic.title }} &rarr;</NuxtLink></div>
          <ol v-if="topicRevisions[item.id]" class="mt-3 grid gap-1 border-t border-[#d7d1c6] pt-3 text-xs text-[#6d6861]"><li v-for="revision in topicRevisions[item.id]" :key="revision.id"><strong>第 {{ revision.revisionNumber }} 版 · {{ topicStatusLabel(revision.status) }}</strong><span v-if="revision.reviewNote"> · {{ revision.reviewNote }}</span></li></ol>
        </article>
      </div>
    </div>

    <div v-else id="stance-proposal-panel" role="tabpanel" aria-labelledby="stance-proposal-tab">
      <div class="mt-4 flex flex-wrap items-start justify-between gap-3">
        <NuxtLink to="/" class="focus-ring text-sm font-black text-[#3157d5]">前往開放議題 &rarr;</NuxtLink>
      </div>
      <p v-if="stanceError" role="alert" class="mt-4 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm text-[#a63222]">{{ stanceError }}</p>
      <div v-if="stanceLoading" class="mt-5 h-40 animate-pulse bg-[#e5e0d6]" />
      <div v-else-if="!stanceItems.length" class="mt-5 border border-dashed border-[#bfb8ad] p-8 text-center text-sm text-[#6d6861]">尚未提交立場提案。請到開放中的議題選擇「立場探索」。</div>
      <div v-else class="mt-5 divide-y divide-[#d7d1c6] border-y border-[#171717] bg-[#faf8f3]">
        <article v-for="item in stanceItems" :key="item.id" class="p-5">
          <div class="flex flex-wrap items-center gap-2 text-xs"><span class="font-black text-[#3157d5]">{{ stanceStatusLabel(item.status) }}</span><time class="text-[#77716a]">更新於 {{ formatTime(item.updatedAt) }}</time></div>
          <div class="mt-3 border-l-4 border-[#3157d5] bg-[#e7ecff] p-3 text-xs"><NuxtLink :to="`/topic/${item.topicId}?section=stances${item.parentStanceId ? `&stance=${item.parentStanceId}` : ''}`" class="focus-ring font-black text-[#3157d5]">議題：{{ item.target.topic.title }}</NuxtLink><p class="mt-1 text-[#5f5a53]">回應位置：{{ targetPath(item) }}</p></div>
          <form v-if="stanceEditingId === item.id" class="mt-3 grid gap-3 border border-dashed border-[#8f8980] bg-white p-4" @submit.prevent="saveStance(item)">
            <input v-model="stanceDraft.title" maxlength="80" class="focus-ring min-h-11 border border-[#bfb8ad] px-3 text-sm font-bold" aria-label="立場名稱" />
            <textarea v-model="stanceDraft.rationale" maxlength="200" rows="3" class="focus-ring border border-[#bfb8ad] p-3 text-sm" aria-label="理由說明" />
            <textarea v-model="stanceDraft.note" maxlength="500" rows="2" class="focus-ring border border-[#bfb8ad] p-3 text-sm" aria-label="給議題小組的備註" />
            <div class="flex justify-end gap-2"><button type="button" class="focus-ring min-h-10 px-3 text-sm" @click="stanceEditingId = ''">取消</button><button class="focus-ring min-h-10 bg-[#3157d5] px-4 text-sm font-black text-white disabled:opacity-40" :disabled="stanceSaving || stanceDraft.title.trim().length < 2">{{ stanceSaving ? '儲存中…' : item.status === 'REJECTED' ? '修改並重新送審' : '儲存修改' }}</button></div>
          </form>
          <template v-else><h3 class="mt-2 text-lg font-black">{{ item.title }}</h3><p v-if="item.rationale" class="mt-2 text-sm leading-6 text-[#6d6861]">{{ item.rationale }}</p></template>
          <p v-if="item.reviewNote" class="mt-3 border-l-2 border-[#d84a36] pl-3 text-sm text-[#6d6861]">議題小組：{{ item.reviewNote }}</p>
          <p v-if="item.note && stanceEditingId !== item.id" class="mt-2 text-xs text-[#77716a]">給小組的補充：{{ item.note }}</p>
          <p v-if="item.target.blockedReason" class="mt-3 bg-[#fbe9e5] p-3 text-sm font-bold text-[#a63222]">{{ item.target.blockedReason }}</p>
          <div class="mt-3 flex flex-wrap gap-3"><button v-if="(item.target.canEdit || item.target.canResubmit) && stanceEditingId !== item.id" type="button" class="focus-ring text-sm font-black text-[#3157d5]" @click="startStanceEdit(item)">{{ item.status === 'REJECTED' ? '修改並重新送審' : '編輯提案' }}</button><button type="button" class="focus-ring text-sm font-black text-[#6d6861]" @click="toggleStanceRevisions(item)">修訂紀錄</button></div>
          <div v-if="item.results.length" class="mt-3 flex flex-wrap gap-3"><NuxtLink v-for="result in item.results" :key="result.stanceId" :to="`/topic/${item.topicId}?section=stances&stance=${result.stanceId}`" class="focus-ring text-sm font-black text-[#3157d5]">{{ result.stance.title }} &rarr;</NuxtLink></div>
          <ol v-if="stanceRevisions[item.id]" class="mt-4 grid gap-3 border-t border-[#d7d1c6] pt-3"><li v-for="revision in stanceRevisions[item.id]" :key="revision.id" class="border border-[#d7d1c6] bg-white p-3 text-xs text-[#6d6861]"><div class="flex flex-wrap justify-between gap-2"><strong class="text-[#171717]">第 {{ revision.revisionNumber }} 版 · {{ stanceStatusLabel(revision.status) }}</strong><time>{{ formatTime(revision.createdAt) }}</time></div><p class="mt-2 font-bold text-[#171717]">{{ revision.title }}</p><p v-if="revision.rationale" class="mt-1 leading-5">{{ revision.rationale }}</p><p v-if="revision.note" class="mt-1">給小組的補充：{{ revision.note }}</p><p v-if="revision.reviewNote" class="mt-2 font-bold text-[#a63222]">小組回覆：{{ revision.reviewNote }}</p></li></ol>
        </article>
      </div>
      <div v-if="stanceTotal > 20" class="mt-5 flex items-center justify-between text-sm font-bold"><button type="button" class="focus-ring border border-[#171717] px-4 py-2 disabled:opacity-30" :disabled="stancePage === 1" @click="changeStancePage(stancePage - 1)">&larr; 上一頁</button><span>第 {{ stancePage }} / {{ Math.ceil(stanceTotal / 20) }} 頁</span><button type="button" class="focus-ring border border-[#171717] px-4 py-2 disabled:opacity-30" :disabled="stancePage * 20 >= stanceTotal" @click="changeStancePage(stancePage + 1)">下一頁 &rarr;</button></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { StanceApplication, StanceApplicationRevision } from '~/types/application';
import type { Category } from '~/types/topic';
import { applyCategoryRules, getCategoryMeta } from '~/utils/topic';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '我的提案｜輿論測風向' });

type ProposalType = 'topic' | 'stance';
interface TopicApplication { id: string; title: string; description: string | null; category: string; topicType: 'BINARY' | 'MULTIPLE' | 'SPECTRUM'; options: string[] | null; blocks: unknown[] | null; voteDurationDays: number; status: string; note: string | null; createdAt: string; updatedAt: string; results: Array<{ topicId: string; topic: { id: string; title: string } }>; organization: { id: string; name: string } | null }
interface TopicRevision { id: string; revisionNumber: number; status: string; reviewNote: string | null }

const route = useRoute();
const router = useRouter();
const api = useApi();
const auth = useAuthStore();
const tabs: Array<{ value: ProposalType; label: string }> = [{ value: 'topic', label: '議題提案' }, { value: 'stance', label: '立場提案' }];
const activeType = ref<ProposalType>(route.query.type === 'stance' ? 'stance' : 'topic');

const topicItems = ref<TopicApplication[]>([]);
const topicLoading = ref(false);
const topicLoaded = ref(false);
const topicError = ref('');
const topicEditingId = ref('');
const topicDraft = reactive({ title: '', description: '', category: '', note: '' });
const topicRevisions = reactive<Record<string, TopicRevision[] | undefined>>({});
const categories = ref<Category[]>([]);

const stanceItems = ref<StanceApplication[]>([]);
const stanceLoading = ref(false);
const stanceLoaded = ref(false);
const stanceError = ref('');
const stancePage = ref(1);
const stanceTotal = ref(0);
const stanceEditingId = ref('');
const stanceSaving = ref(false);
const stanceDraft = reactive({ title: '', rationale: '', note: '' });
const stanceRevisions = reactive<Record<string, StanceApplicationRevision[] | undefined>>({});

const topicLabels: Record<string, string> = { PENDING: '待處理', IN_REVIEW: '整理中', APPROVED: '已採用', REJECTED: '未採用', WITHDRAWN: '已撤回' };
const stanceLabels: Record<string, string> = { PENDING: '已送出 · 可修改', IN_REVIEW: '小組審閱中 · 暫停修改', APPROVED: '已轉為正式立場', REJECTED: '請修改後重送', WITHDRAWN: '已撤回' };
const topicStatusLabel = (status: string) => topicLabels[status] || status;
const stanceStatusLabel = (status: string) => stanceLabels[status] || status;
const formatTime = (value: string) => new Date(value).toLocaleDateString('zh-TW');
const targetPath = (item: StanceApplication) => item.target.kind === 'TOPIC' ? '直接回應議題' : `${item.target.path.map((node) => node.title).join(' / ')}之下`;

async function setType(type: ProposalType) {
  await router.replace({ query: type === 'topic' ? {} : { type } });
}
async function loadActive() {
  if (activeType.value === 'topic') await loadTopics();
  else await loadStances();
}
async function loadTopics(force = false) {
  if (topicLoaded.value && !force) return;
  topicLoading.value = true; topicError.value = '';
  try { topicItems.value = (await api.get<{ items: TopicApplication[] }>('/topic-applications/mine')).items; topicLoaded.value = true; }
  catch (cause) { topicError.value = errorMessage(cause); }
  finally { topicLoading.value = false; }
}
function startTopicEdit(item: TopicApplication) { topicEditingId.value = item.id; Object.assign(topicDraft, { title: item.title, description: item.description || '', category: item.category, note: item.note || '' }); }
async function saveTopic(item: TopicApplication) {
  topicError.value = '';
  try {
    await api.patch(`/topic-applications/${item.id}`, { ...topicDraft, description: topicDraft.description || undefined, note: topicDraft.note || undefined, topicType: item.topicType, options: item.options || undefined, blocks: item.blocks || undefined, voteDurationDays: item.voteDurationDays, expectedUpdatedAt: item.updatedAt });
    topicEditingId.value = ''; await loadTopics(true);
  } catch (cause) { topicError.value = errorMessage(cause); }
}
async function toggleTopicRevisions(item: TopicApplication) {
  if (topicRevisions[item.id]) { topicRevisions[item.id] = undefined; return; }
  try { topicRevisions[item.id] = await api.get<TopicRevision[]>(`/topic-applications/${item.id}/revisions`); }
  catch (cause) { topicError.value = errorMessage(cause); }
}
async function loadStances(force = false) {
  if (stanceLoaded.value && !force) return;
  stanceLoading.value = true; stanceError.value = '';
  try {
    const result = await api.get<{ items: StanceApplication[]; pagination: { total: number } }>('/stance-applications/mine', { page: stancePage.value, limit: 20 });
    stanceItems.value = result.items; stanceTotal.value = result.pagination.total; stanceLoaded.value = true;
  } catch (cause) { stanceError.value = errorMessage(cause); }
  finally { stanceLoading.value = false; }
}
function changeStancePage(value: number) { stancePage.value = value; loadStances(true); }
function startStanceEdit(item: StanceApplication) { stanceEditingId.value = item.id; Object.assign(stanceDraft, { title: item.title, rationale: item.rationale || '', note: item.note || '' }); }
async function saveStance(item: StanceApplication) {
  stanceSaving.value = true; stanceError.value = '';
  try { await api.patch(`/stance-applications/${item.id}`, { ...stanceDraft, expectedUpdatedAt: item.updatedAt }); stanceEditingId.value = ''; await loadStances(true); }
  catch (cause) { stanceError.value = errorMessage(cause); }
  finally { stanceSaving.value = false; }
}
async function toggleStanceRevisions(item: StanceApplication) {
  if (stanceRevisions[item.id]) { stanceRevisions[item.id] = undefined; return; }
  try { stanceRevisions[item.id] = await api.get<StanceApplicationRevision[]>(`/stance-applications/${item.id}/revisions`); }
  catch (cause) { stanceError.value = errorMessage(cause); }
}

watch(() => route.query.type, async (type) => {
  activeType.value = type === 'stance' ? 'stance' : 'topic';
  await loadActive();
});
onMounted(async () => {
  await loadActive();
  try {
    categories.value = (await api.get<Category[]>('/categories')).filter((item) => item.isActive);
    applyCategoryRules(categories.value);
  } catch {
    categories.value = [];
  }
});
</script>
