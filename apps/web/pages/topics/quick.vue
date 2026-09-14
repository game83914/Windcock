<template>
  <div class="mx-auto max-w-6xl pb-12">
    <div class="mb-8 border-b border-[#ded7cb] pb-6">
      <p class="eyebrow-modern text-[#b0761f]">UGC 微投票 · 立即開票</p>
      <h1 class="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">發起今天快問</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-[#6d6861]">資深會員可發起輕量微投票，立即開票、即時看風向，適合今天就想知道答案的生活問題。</p>
    </div>

    <div v-if="savedTopic" class="surface-card p-8 text-center sm:p-12">
      <p class="eyebrow-modern text-[#b0761f]">快問已開票</p>
      <h2 class="mt-3 text-2xl font-black">你的快問上線了</h2>
      <p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6d6861]">投票時間 {{ savedTopic.voteDurationHours }} 小時，結束後會依集票情況結算。現在就可以到詳情頁投下第一票。</p>
      <div class="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <UiButton :to="`/topic/${savedTopic.id}`" variant="quick">前往快問詳情</UiButton>
        <UiButton :to="'/me/quick'" variant="outline">查看我的快問</UiButton>
      </div>
    </div>

    <div v-else-if="loading" class="h-96 animate-pulse rounded-2xl bg-[#e5e0d6]" />

    <div v-else-if="!canCreateQuick" class="surface-card p-6 sm:p-8">
      <p class="eyebrow-modern text-[#b0761f]">資深會員限定</p>
      <h2 class="mt-2 text-xl font-black">成為資深會員後即可發起快問</h2>
      <p class="mt-3 text-sm leading-6 text-[#6d6861]">帳號需滿 30 天，並在至少 10 個不同議題完成投票。目前為 {{ eligibility?.accountAgeDays ?? 0 }} 天、{{ eligibility?.distinctTopicsVoted ?? 0 }} 個議題。</p>
      <UiButton :to="'/'" variant="primary" class="mt-5">先來探索快問</UiButton>
    </div>

    <div v-else class="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <form class="space-y-6" novalidate @submit.prevent="submit">
        <section class="surface-card p-5 sm:p-7">
          <p class="eyebrow-modern text-[#b0761f]">01 / 投票問題</p>
          <label class="mt-6 block">
            <span class="mb-2 flex justify-between text-sm font-bold"><span>快問標題</span><span class="font-normal text-[#8b857d]">{{ title.length }} / 100</span></span>
            <input v-model.trim="title" data-field="title" maxlength="100" minlength="5" placeholder="例如：你今天中午打算吃什麼？" class="field-input" :class="{ 'field-input-error': fieldErrors.title }" />
            <p v-if="fieldErrors.title" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors.title }}</p>
          </label>
        </section>

        <section class="surface-card p-5 sm:p-7">
          <p class="eyebrow-modern text-[#b0761f]">02 / 投票設定</p>
          <div class="mt-6">
            <span class="mb-2 block text-sm font-bold">分類</span>
            <div class="flex flex-wrap gap-2">
              <button v-for="item in categories" :key="item.key" type="button" class="focus-ring flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition" :class="category === item.key ? 'border-[#b0761f] bg-[#b0761f] text-white' : 'border-[#cfc8bc] bg-white hover:border-[#b0761f]'" @click="category = item.key"><span class="inline-block h-2 w-2 rounded-full" :style="{ backgroundColor: getCategoryMeta(item.key).color }" />{{ getCategoryMeta(item.key).label }}</button>
            </div>
          </div>
          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <button v-for="item in topicTypes" :key="item.value" type="button" class="focus-ring rounded-2xl border-2 p-4 text-left transition" :class="topicType === item.value ? 'border-[#b0761f] bg-[#f8ecd6]' : 'border-[#ded7cb] bg-white hover:border-[#b0761f]'" @click="setTopicType(item.value)">
              <strong class="block text-sm">{{ item.label }}</strong>
              <span class="mt-1 block text-xs leading-5 text-[#77716a]">{{ item.description }}</span>
            </button>
          </div>
          <div class="mt-6 border-t border-[#f0e6d2] pt-5">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold">投票選項</span>
              <button v-if="topicType === 'MULTIPLE' && options.length < 4" type="button" class="focus-ring rounded-full text-xs font-bold text-[#b0761f] hover:underline" @click="options.push('')">＋ 新增選項</button>
            </div>
            <div class="mt-3 space-y-3">
              <div v-for="(_, index) in options" :key="index" class="flex items-center gap-3">
                <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f0e6d2] text-xs font-black text-[#8f5d14]">{{ index + 1 }}</span>
                <input v-model.trim="options[index]" :data-field="`option-${index}`" maxlength="50" :placeholder="`選項 ${index + 1}`" class="field-input" :class="{ 'field-input-error': fieldErrors[`option-${index}`] }" />
                <button v-if="topicType === 'MULTIPLE' && options.length > 2" type="button" class="focus-ring rounded-full px-2 text-xl text-[#8b857d]" aria-label="刪除選項" @click="options.splice(index, 1)">&times;</button>
              </div>
            </div>
          </div>
          <div class="mt-6 border-t border-[#f0e6d2] pt-5">
            <span class="mb-2 block text-sm font-bold">投票時間</span>
            <div class="flex flex-wrap gap-2">
              <button v-for="item in durationOptions" :key="item.value" type="button" class="focus-ring rounded-full border px-4 py-2.5 text-sm font-bold transition" :class="voteDurationHours === item.value ? 'border-[#b0761f] bg-[#b0761f] text-white' : 'border-[#cfc8bc] bg-white hover:border-[#b0761f]'" @click="voteDurationHours = item.value">{{ item.label }}</button>
            </div>
          </div>
        </section>

        <label class="flex cursor-pointer items-start gap-3 surface-quick p-5 text-sm leading-6">
          <input v-model="agreed" type="checkbox" class="mt-1 h-4 w-4 accent-[#b0761f]" />
          <span>我確認內容為善意生活觀察，未涉及誹謗、個人資料、違法內容或未經證實的指控，並同意平台即時公開開票。</span>
        </label>

        <p v-if="formError" class="rounded-2xl border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm text-[#a63222]">{{ formError }}</p>

        <div class="flex flex-col items-center gap-2">
          <UiButton type="submit" variant="quick" block size="lg" :disabled="submitting || !agreed">
            {{ submitting ? '開票中…' : '發起快問並開票' }}
          </UiButton>
          <p class="text-xs text-[#77716a]">資深會員每天最多發起 3 則快問。</p>
        </div>
      </form>

      <aside class="lg:sticky lg:top-28 lg:self-start">
        <p class="eyebrow-modern mb-3 text-[#77716a]">快問預覽</p>
        <div class="surface-quick p-6">
          <div class="flex items-center justify-between text-xs"><span class="font-bold" :style="{ color: getCategoryMeta(category).color }">{{ category ? getCategoryMeta(category).label : '尚未選擇分類' }}</span><span class="rounded-full bg-[#b0761f] px-2.5 py-0.5 text-[10px] font-black text-white">⚡ 快問</span></div>
          <h2 class="mt-6 text-2xl font-black leading-snug">{{ title || '你的快問會顯示在這裡' }}</h2>
          <ul class="mt-6 space-y-2 border-t border-[#f0e6d2] pt-4">
            <li v-for="option in visibleOptions" :key="option" class="flex items-center gap-3 text-sm"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f0e6d2] text-[10px] font-black text-[#8f5d14]">{{ options.indexOf(option) + 1 }}</span><span class="font-medium">{{ option || '⋯' }}</span></li>
          </ul>
          <p class="mt-7 border-t border-[#f0e6d2] pt-4 text-xs text-[#8f5d14]">立即開票 · {{ durationLabel }} · 投完即見分佈</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Category, Topic } from '~/types/topic';
import { errorMessage } from '~/composables/useApi';
import { applyCategoryRules, getCategoryMeta } from '~/utils/topic';
import type { CapabilitySummary } from '~/stores/auth';

definePageMeta({ middleware: 'auth' });

type QuickType = 'BINARY' | 'MULTIPLE';

const route = useRoute();
const api = useApi();
const auth = useAuthStore();
useSeoMeta({ title: '發起快問｜輿論測風向' });

const categories = ref<Array<{ key: string }>>([]);
const topicTypes: { value: QuickType; label: string; description: string }[] = [
  { value: 'BINARY', label: '二選一', description: '兩個明確選項，最快集票' },
  { value: 'MULTIPLE', label: '多選項', description: '2 到 4 個方向' },
];
const durationOptions = [
  { value: 6, label: '6 小時' },
  { value: 12, label: '12 小時' },
  { value: 24, label: '24 小時' },
  { value: 48, label: '2 天' },
];

const title = ref('');
const category = ref('');
const topicType = ref<QuickType>('BINARY');
const options = ref(['選 A', '選 B']);
const voteDurationHours = ref(24);
const agreed = ref(false);
const loading = ref(true);
const submitting = ref(false);
const formError = ref('');
const fieldErrors = reactive<Record<string, string>>({});
const savedTopic = ref<Topic | null>(null);
const eligibility = computed(() => auth.capabilitySummary?.seniorEligibility);
const canCreateQuick = computed(() => auth.isAuthed && (auth.canAuthorTopics || auth.capabilitySummary?.membershipTier === 'SENIOR'));
const durationLabel = computed(() => durationOptions.find((item) => item.value === voteDurationHours.value)?.label ?? `${voteDurationHours.value} 小時`);
const visibleOptions = computed(() => options.value.filter((option) => option.trim()));

function setTopicType(type: QuickType) {
  topicType.value = type;
  if (type === 'BINARY') options.value = ['選 A', '選 B'];
  else if (options.value.length < 2) options.value = ['選項一', '選項二'];
}

function validateForm() {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
  if (title.value.length < 5) fieldErrors.title = '快問標題至少需要 5 個字';
  if (!category.value) formError.value = '請選擇一個分類。';
  options.value.forEach((option, index) => {
    if (!option.trim()) fieldErrors[`option-${index}`] = `請填寫選項 ${index + 1}`;
  });
  if (new Set(options.value.map((item) => item.trim())).size !== options.value.length) formError.value = '投票選項不可重複。';
  return Object.keys(fieldErrors)[0];
}

async function submit() {
  formError.value = '';
  const firstInvalidField = validateForm();
  if (firstInvalidField || formError.value) {
    if (firstInvalidField) {
      await nextTick();
      document.querySelector<HTMLElement>(`[data-field="${firstInvalidField}"]`)?.focus();
    }
    return;
  }
  submitting.value = true;
  try {
    savedTopic.value = await api.post<Topic>('/topics/quick', {
      title: title.value,
      category: category.value,
      topicType: topicType.value,
      options: options.value,
      voteDurationHours: voteDurationHours.value,
    });
  } catch (error) {
    formError.value = errorMessage(error);
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  try {
    const [summary, categoryItems] = await Promise.all([
      api.get<CapabilitySummary>('/me/capabilities'),
      api.get<Category[]>('/categories'),
    ]);
    auth.setCapabilities(summary);
    categories.value = categoryItems.filter((item) => item.isActive);
    applyCategoryRules(categoryItems);
    if (categories.value[0]) category.value = categories.value[0].key;
  } catch (error) {
    formError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
});
</script>