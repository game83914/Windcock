<template>
  <section class="mx-auto max-w-5xl pb-12">
    <header class="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#171717] pb-5">
      <div>
        <p class="eyebrow text-[#3f7a58]">議題小組</p>
        <h1 class="mt-1 text-3xl font-black tracking-[-0.04em]">內容設定</h1>
        <p class="mt-2 text-sm text-[#6d6861]">管理首頁議題分類與置頂議題；變更會立即套用於公開頁面。</p>
      </div>
      <div class="grid grid-cols-2 border-2 border-[#171717]" role="tablist" aria-label="內容設定分頁">
        <button v-for="tab in tabs" :key="tab.value" type="button" role="tab" class="focus-ring min-h-11 px-5 text-sm font-black" :class="activeTab === tab.value ? 'bg-[#171717] text-white' : 'bg-[#faf8f3] text-[#5f5a53]'" :aria-selected="activeTab === tab.value" @click="activeTab = tab.value">{{ tab.label }}</button>
      </div>
    </header>

    <p v-if="notice" role="status" class="mt-5 border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-4 text-sm font-bold text-[#2f6547]">{{ notice }}</p>
    <p v-if="error" role="alert" class="mt-5 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm font-bold text-[#a63222]">{{ error }}</p>

    <div v-if="activeTab === 'categories'" id="categories-panel" role="tabpanel" :aria-label="'分類管理分頁'">
      <div class="mt-6">
        <h2 class="text-xl font-black">新增分類</h2>
        <form class="mt-3 grid gap-4 border-2 border-[#171717] bg-[#faf8f3] p-5 sm:grid-cols-2" @submit.prevent="createCategory">
          <label class="block text-xs font-black">分類 key（英文，用於網址與資料）
            <input v-model.trim="newCategory.key" maxlength="30" required placeholder="例如：education" class="focus-ring mt-1 min-h-11 w-full border border-[#bfb8ad] bg-white px-3 text-sm" />
          </label>
          <label class="block text-xs font-black">顯示名稱
            <input v-model.trim="newCategory.label" maxlength="20" required placeholder="例如：教育" class="focus-ring mt-1 min-h-11 w-full border border-[#bfb8ad] bg-white px-3 text-sm" />
          </label>
          <label class="block text-xs font-black">類別眉題（兩到四字）
            <input v-model.trim="newCategory.eyebrow" maxlength="30" required placeholder="例如：學習與未來" class="focus-ring mt-1 min-h-11 w-full border border-[#bfb8ad] bg-white px-3 text-sm" />
          </label>
          <label class="block text-xs font-black">排序（數字越小越前面）
            <input v-model.number="newCategory.sortOrder" type="number" min="0" step="1" class="focus-ring mt-1 min-h-11 w-full border border-[#bfb8ad] bg-white px-3 text-sm" />
          </label>
          <label class="block text-xs font-black">主色
            <div class="mt-1 flex items-center gap-3"><input v-model="newCategory.color" type="color" class="h-11 w-16 border border-[#bfb8ad] bg-white p-1" /><span class="text-xs text-[#77716a]">{{ newCategory.color }}</span></div>
          </label>
          <label class="block text-xs font-black">底色
            <div class="mt-1 flex items-center gap-3"><input v-model="newCategory.soft" type="color" class="h-11 w-16 border border-[#bfb8ad] bg-white p-1" /><span class="text-xs text-[#77716a]">{{ newCategory.soft }}</span></div>
          </label>
          <button class="focus-ring min-h-11 bg-[#171717] px-5 text-sm font-black text-white sm:col-span-2" :disabled="submitting">{{ submitting ? '建立中…' : '建立分類' }}</button>
        </form>
      </div>

      <div class="mt-8 grid gap-4">
        <article v-for="item in categories" :key="item.key" class="grid gap-4 border-2 border-[#171717] bg-[#faf8f3] p-5 sm:grid-cols-6">
          <div class="sm:col-span-3">
            <div class="flex items-center gap-3">
              <span class="grid h-9 min-w-9 place-items-center px-2 text-sm font-black text-white" :style="{ backgroundColor: item.color }">{{ getCategoryMeta(item.key).label }}</span>
              <strong class="text-sm font-black">{{ item.key }}</strong>
              <span v-if="!item.isActive" class="bg-[#d7d1c6] px-2 py-1 text-[10px] font-black">已停用</span>
            </div>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <label class="block text-xs font-black">顯示名稱 <input v-model="item.label" maxlength="20" class="focus-ring mt-1 min-h-10 w-full border border-[#bfb8ad] bg-white px-3 text-sm" /></label>
              <label class="block text-xs font-black">眉題 <input v-model="item.eyebrow" maxlength="30" class="focus-ring mt-1 min-h-10 w-full border border-[#bfb8ad] bg-white px-3 text-sm" /></label>
              <label class="block text-xs font-black">排序 <input v-model.number="item.sortOrder" type="number" min="0" step="1" class="focus-ring mt-1 min-h-10 w-full border border-[#bfb8ad] bg-white px-3 text-sm" /></label>
              <label class="block text-xs font-black">主色 <div class="mt-1 flex items-center gap-2"><input v-model="item.color" type="color" class="h-10 w-14 border border-[#bfb8ad] bg-white p-1" /><span class="text-[11px] text-[#77716a]">{{ item.color }}</span></div></label>
              <label class="block text-xs font-black">底色 <div class="mt-1 flex items-center gap-2"><input v-model="item.soft" type="color" class="h-10 w-14 border border-[#bfb8ad] bg-white p-1" /><span class="text-[11px] text-[#77716a]">{{ item.soft }}</span></div></label>
            </div>
          </div>
          <div class="flex flex-wrap items-start gap-2 sm:col-span-3 sm:justify-end">
            <button type="button" class="focus-ring min-h-10 border border-[#171717] px-4 text-xs font-black" :disabled="working === item.key" @click="saveCategory(item)">儲存分類</button>
            <button type="button" class="focus-ring min-h-10 border border-[#3157d5] px-4 text-xs font-black text-[#3157d5]" :disabled="working === item.key" @click="toggleCategory(item)">{{ item.isActive ? '停用' : '啟用' }}</button>
            <button type="button" class="focus-ring min-h-10 border border-[#d84a36] px-4 text-xs font-black text-[#a63222]" :disabled="working === item.key" @click="deleteCategory(item)">刪除</button>
          </div>
        </article>
      </div>
    </div>

    <div v-else id="featured-panel" role="tabpanel" :aria-label="'置頂議題分頁'">
      <div class="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 class="text-xl font-black">置頂議題</h2>
          <p class="mt-1 text-sm leading-6 text-[#6d6861]">置頂議題會以設定的順序顯示首頁，最多 5 筆，也可包含已結束的公開議題。取消勾選或不在清單中的議題會自動取消置頂。</p>
        </div>
        <button type="button" class="focus-ring min-h-11 bg-[#171717] px-5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40" :disabled="savingFeatured" @click="saveFeatured">{{ savingFeatured ? '儲存中…' : '儲存置頂順序' }}</button>
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <label class="text-xs font-black">搜尋議題
          <input v-model.trim="search" maxlength="100" placeholder="以標題搜尋" class="focus-ring mt-1 min-h-10 w-64 border border-[#bfb8ad] bg-white px-3 text-sm" @keyup.enter="loadCandidates" />
        </label>
        <button type="button" class="focus-ring min-h-10 border border-[#171717] px-4 text-xs font-black" @click="loadCandidates">搜尋</button>
        <span v-if="candidates.length" class="text-xs text-[#77716a]">共 {{ candidates.length }} 筆已核准公開議題｜目前置頂 {{ featuredIds.length }} / 5 筆</span>
      </div>

      <div v-if="candidatesLoading" class="mt-5 h-56 animate-pulse bg-[#e5e0d6]" />
      <p v-else-if="!candidates.length" class="mt-5 border border-dashed border-[#bfb8ad] p-12 text-center text-sm text-[#6d6861]">沒有符合條件的議題。</p>
      <div v-else class="mt-5 divide-y divide-[#d7d1c6] border-y border-[#171717] bg-[#faf8f3]">
        <article v-for="item in orderedItems" :key="item.id" class="flex flex-wrap items-center gap-4 p-5">
          <span v-if="featuredIndex(item) >= 0" class="grid h-9 w-9 shrink-0 place-items-center bg-[#171717] text-sm font-black text-white">{{ featuredIndex(item) + 1 }}</span>
          <label v-else class="flex shrink-0 items-center gap-2 text-xs font-black"><input type="checkbox" class="h-4 w-4 accent-[#d84a36]" :checked="featuredIndex(item) >= 0" @change="addFeatured(item)" />置頂</label>
          <div class="min-w-0 flex-1">
            <p class="truncate font-black">{{ item.title }}</p>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#77716a]">
              <span :style="{ color: getCategoryMeta(item.category).color }">{{ getCategoryMeta(item.category).label }}</span>
              <span>{{ formatCompactNumber(item.totalVotes) }} 人參與</span>
              <span :class="item.status === 'OPEN' ? 'font-bold text-[#3f7a58]' : 'bg-[#ebe6dc] px-2 py-0.5'">{{ statusLabel(item.status) }}</span>
            </div>
          </div>
          <div v-if="featuredIndex(item) >= 0" class="flex shrink-0 items-center gap-1 text-xs font-black">
            <button type="button" class="focus-ring min-h-9 border border-[#171717] px-3 disabled:cursor-not-allowed disabled:opacity-30" :disabled="featuredIndex(item) === 0" @click="moveFeatured(item, -1)">上移</button>
            <button type="button" class="focus-ring min-h-9 border border-[#171717] px-3 disabled:cursor-not-allowed disabled:opacity-30" :disabled="featuredIndex(item) >= featuredIds.length - 1" @click="moveFeatured(item, 1)">下移</button>
            <button type="button" class="focus-ring min-h-9 border border-[#a63222] px-3 text-[#a63222]" @click="removeFeatured(item)">取消置頂</button>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Category, Topic } from '~/types/topic';
import { applyCategoryRules, formatCompactNumber, getCategoryMeta } from '~/utils/topic';
import { useCategories } from '~/composables/useCategories';
import { errorMessage } from '~/composables/useApi';

definePageMeta({ middleware: 'editorial' });
useSeoMeta({ title: '內容設定｜輿論測風向' });

const api = useApi();
const { data: categoryData, active: activeCategories, refresh: refreshCategories } = useCategories();
const categories = ref<Category[]>([]);
const notice = ref('');
const error = ref('');
const submitting = ref(false);
const working = ref('');
const activeTab = ref<'categories' | 'featured'>('categories');
const tabs: Array<{ value: 'categories' | 'featured'; label: string }> = [{ value: 'categories', label: '分類管理' }, { value: 'featured', label: '置頂議題' }];
const newCategory = reactive({ key: '', label: '', eyebrow: '', color: '#3f7a58', soft: '#e5f1e9', sortOrder: 0 });

const featuredIds = ref<string[]>([]);
const candidates = ref<Topic[]>([]);
const featuredTopics = ref<Topic[]>([]);
const candidatesLoading = ref(false);
const savingFeatured = ref(false);
const search = ref('');

const statusLabels: Record<string, string> = { OPEN: '開票中', CLOSED: '討論結束', ENDED: '已結束', DRAFT: '草稿' };
const statusLabel = (value: string) => statusLabels[value] || value;

function syncCategories() {
  categories.value = [...(categoryData.value ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}

const orderedItems = computed<Topic[]>(() => {
  const ordered = featuredIds.value
    .map((id) => featuredTopics.value.find((topic) => topic.id === id))
    .filter((topic): topic is Topic => Boolean(topic));
  const rest = candidates.value.filter((topic) => !featuredIds.value.includes(topic.id));
  return [...ordered, ...rest];
});

function featuredIndex(item: Topic) {
  return featuredIds.value.indexOf(item.id);
}

function addFeatured(item: Topic) {
  if (featuredIds.value.includes(item.id)) return;
  if (featuredIds.value.length >= 5) {
    error.value = '置頂議題最多 5 筆';
    return;
  }
  featuredIds.value = [...featuredIds.value, item.id];
  if (!featuredTopics.value.some((topic) => topic.id === item.id)) featuredTopics.value = [...featuredTopics.value, item];
}

function removeFeatured(item: Topic) {
  featuredIds.value = featuredIds.value.filter((id) => id !== item.id);
}

function moveFeatured(item: Topic, direction: number) {
  const index = featuredIds.value.indexOf(item.id);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= featuredIds.value.length) return;
  const next = [...featuredIds.value];
  [next[index], next[destination]] = [next[destination], next[index]];
  featuredIds.value = next;
}

async function createCategory() {
  submitting.value = true; error.value = ''; notice.value = '';
  try {
    await api.post('/categories', {
      key: newCategory.key.trim(),
      label: newCategory.label.trim(),
      eyebrow: newCategory.eyebrow.trim(),
      color: newCategory.color,
      soft: newCategory.soft,
      sortOrder: newCategory.sortOrder,
    });
    notice.value = '分類已建立。';
    Object.assign(newCategory, { key: '', label: '', eyebrow: '', color: '#3f7a58', soft: '#e5f1e9', sortOrder: 0 });
    await refreshCategories();
    syncCategories();
  } catch (cause) { error.value = errorMessage(cause); }
  finally { submitting.value = false; }
}

async function saveCategory(item: Category) {
  working.value = item.key; error.value = ''; notice.value = '';
  try {
    await api.patch(`/categories/${item.key}`, { label: item.label.trim(), eyebrow: item.eyebrow.trim(), color: item.color, soft: item.soft, sortOrder: item.sortOrder });
    notice.value = '分類已更新。';
    await refreshCategories();
    syncCategories();
  } catch (cause) { error.value = errorMessage(cause); }
  finally { working.value = ''; }
}

async function toggleCategory(item: Category) {
  working.value = item.key; error.value = ''; notice.value = '';
  try {
    await api.patch(`/categories/${item.key}`, { isActive: !item.isActive });
    notice.value = item.isActive ? '分類已停用。' : '分類已啟用。';
    await refreshCategories();
    syncCategories();
  } catch (cause) { error.value = errorMessage(cause); }
  finally { working.value = ''; }
}

async function deleteCategory(item: Category) {
  const message = `確定刪除分類「${item.label}」嗎？分類下有議題時無法刪除。`;
  if (!confirm(message)) return;
  working.value = item.key; error.value = ''; notice.value = '';
  try {
    await api.delete(`/categories/${item.key}`);
    notice.value = '分類已刪除。';
    await refreshCategories();
    syncCategories();
  } catch (cause) { error.value = errorMessage(cause); }
  finally { working.value = ''; }
}

async function loadFeatured() {
  error.value = '';
  try {
    const items = await api.get<Topic[]>('/topics/featured');
    featuredTopics.value = items;
    featuredIds.value = items.map((topic) => topic.id);
  } catch (cause) { error.value = errorMessage(cause); }
}

async function loadCandidates() {
  candidatesLoading.value = true; error.value = '';
  try {
    candidates.value = await api.get<Topic[]>('/topics/featured/candidates', { search: search.value || undefined, limit: 100 });
  } catch (cause) { error.value = errorMessage(cause); }
  finally { candidatesLoading.value = false; }
}

async function saveFeatured() {
  savingFeatured.value = true; error.value = ''; notice.value = '';
  try {
    await api.put('/topics/featured', { topicIds: featuredIds.value });
    notice.value = `已套用置頂順序（${featuredIds.value.length} 筆）。`;
    await Promise.all([loadFeatured(), loadCandidates()]);
  } catch (cause) { error.value = errorMessage(cause); }
  finally { savingFeatured.value = false; }
}

watch(categoryData, () => syncCategories());
watch(activeTab, (tab) => {
  if (tab === 'featured') {
    if (!featuredTopics.value.length) loadFeatured();
    if (!candidates.value.length) loadCandidates();
  }
  error.value = '';
  notice.value = '';
});

onMounted(async () => {
  syncCategories();
  applyCategoryRules(categoryData.value ?? []);
  if (activeTab.value === 'featured') {
    await Promise.all([loadFeatured(), loadCandidates()]);
  }
});
</script>
