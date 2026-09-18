<template>
  <div>
    <div class="mb-8 border-b-2 border-[#171717] pb-6">
      <h1 class="mt-2 text-3xl font-black tracking-[-0.04em]">草稿與範本</h1>
      <p class="mt-2 text-sm leading-6 text-[#6d6861]">未送出的發起內容可存成草稿；常用的可存為範本，在發起頁一鍵套用。</p>
    </div>

    <div class="mb-5 flex flex-wrap gap-2 text-sm font-bold">
      <button type="button" class="focus-ring rounded-full px-4 py-2 transition" :class="kind === 'QUICK' ? 'bg-[#171717] text-white' : 'bg-[#ebe6dc] text-[#6d6861] hover:bg-[#e0d9cc]'" @click="kind = 'QUICK'">快問</button>
      <button type="button" class="focus-ring rounded-full px-4 py-2 transition" :class="kind === 'SURVEY' ? 'bg-[#171717] text-white' : 'bg-[#ebe6dc] text-[#6d6861] hover:bg-[#e0d9cc]'" @click="kind = 'SURVEY'">問卷</button>
      <span class="mx-1 hidden h-6 w-px self-center bg-[#d7d1c6] sm:block" aria-hidden="true" />
      <button type="button" class="focus-ring rounded-full px-4 py-2 transition" :class="!onlyTemplates ? 'bg-[#b0761f] text-white' : 'bg-[#ebe6dc] text-[#6d6861] hover:bg-[#e0d9cc]'" @click="onlyTemplates = false">草稿</button>
      <button type="button" class="focus-ring rounded-full px-4 py-2 transition" :class="onlyTemplates ? 'bg-[#b0761f] text-white' : 'bg-[#ebe6dc] text-[#6d6861] hover:bg-[#e0d9cc]'" @click="onlyTemplates = true">範本</button>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="item in 3" :key="item" class="h-28 animate-pulse bg-[#e5e0d6]" />
    </div>
    <p v-else-if="loadError" class="border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm">{{ loadError }}</p>
    <div v-else-if="items.length" class="space-y-4">
      <article v-for="item in items" :key="item.id" class="border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:p-6">
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="bg-[#b0761f] px-2 py-1 font-bold text-white">{{ item.kind === 'QUICK' ? '快問' : '問卷' }}</span>
          <span class="bg-[#eef1fb] px-2 py-1 font-bold text-[#3157d5]">{{ item.isTemplate ? '範本' : '草稿' }}</span>
        </div>
        <div class="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0 flex-1">
            <template v-if="editingId === item.id">
              <input
                v-model.trim="editingName"
                maxlength="50"
                class="field-input w-full text-base font-black"
                aria-label="草稿名稱"
                @keydown.enter="confirmRename(item)"
                @keydown.escape="cancelRename"
              />
              <div class="mt-2 flex gap-3 text-sm font-bold">
                <button type="button" class="focus-ring text-[#3f7a58]" :disabled="busyId === item.id" @click="confirmRename(item)">{{ busyId === item.id ? '儲存中…' : '儲存' }}</button>
                <button type="button" class="focus-ring text-[#77716a]" :disabled="busyId === item.id" @click="cancelRename">取消</button>
              </div>
            </template>
            <template v-else>
              <h2 class="truncate text-xl font-black leading-snug">{{ item.name }}</h2>
              <p class="mt-2 truncate text-xs text-[#77716a]">{{ payloadTitle(item) }} · 更新於 {{ formatTimeAgo(item.updatedAt, deadlineNow) }}</p>
            </template>
          </div>
          <div class="flex shrink-0 flex-wrap gap-3 text-sm font-bold">
            <NuxtLink :to="`${item.kind === 'QUICK' ? '/topics/quick' : '/topics/survey'}?draftId=${item.id}`" class="focus-ring text-[#b0761f]">開啟套用 &rarr;</NuxtLink>
            <button v-if="editingId !== item.id" type="button" class="focus-ring text-[#6d6861]" :disabled="busyId === item.id" @click="startRename(item)">改名</button>
            <button type="button" class="focus-ring text-[#3157d5]" :disabled="busyId === item.id" @click="toggleTemplate(item)">{{ item.isTemplate ? '轉回草稿' : '存為範本' }}</button>
            <button type="button" class="focus-ring text-[#a63222]" :disabled="busyId === item.id" @click="removeItem(item)">刪除</button>
          </div>
        </div>
      </article>
    </div>
    <div v-else class="border border-[#d7d1c6] bg-[#faf8f3] px-6 py-16 text-center">
      <h2 class="text-xl font-black">{{ onlyTemplates ? '還沒有自存範本' : '還沒有草稿' }}</h2>
      <p class="mt-2 text-sm text-[#77716a]">{{ onlyTemplates ? '可在下方把草稿轉為範本，或到發起頁儲存。' : '到發起頁填寫內容後，即可儲存草稿。' }}</p>
    </div>
    <p v-if="actionMessage" class="mt-4 border-l-4 border-[#3157d5] bg-[#eef1fb] p-3 text-sm text-[#233f9e]">{{ actionMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import type { DraftItem, DraftKind } from '~/types/draft';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '草稿與範本｜輿論測風向' });

const { listDrafts, updateDraft, deleteDraft } = useDrafts();
const deadlineNow = useDeadlineNow();

const kind = ref<DraftKind>('QUICK');
const onlyTemplates = ref(false);
const items = ref<DraftItem[]>([]);
const loading = ref(true);
const loadError = ref('');
const busyId = ref('');
const actionMessage = ref('');
const editingId = ref('');
const editingName = ref('');

function payloadTitle(item: DraftItem): string {
  const data = (item.payload as { data?: { title?: unknown } } | null)?.data;
  return typeof data?.title === 'string' && data.title.trim() ? data.title.trim() : '未命名標題';
}

async function refresh() {
  cancelRename();
  loading.value = true;
  loadError.value = '';
  try {
    items.value = await listDrafts(kind.value, onlyTemplates.value);
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

watch([kind, onlyTemplates], () => { void refresh(); });

function startRename(item: DraftItem) {
  editingId.value = item.id;
  editingName.value = item.name;
  actionMessage.value = '';
}

function cancelRename() {
  editingId.value = '';
  editingName.value = '';
}

async function confirmRename(item: DraftItem) {
  const name = editingName.value.trim();
  if (!name) {
    actionMessage.value = '請填寫名稱。';
    return;
  }
  if (name.length > 50) {
    actionMessage.value = '名稱不可超過 50 個字。';
    return;
  }
  if (name === item.name) {
    cancelRename();
    return;
  }
  busyId.value = item.id;
  actionMessage.value = '';
  try {
    const updated = await updateDraft(item.id, { name });
    if (updated) {
      actionMessage.value = `已重新命名為「${updated.name}」。`;
      cancelRename();
      await refresh();
    }
  } finally {
    busyId.value = '';
  }
}

async function toggleTemplate(item: DraftItem) {
  busyId.value = item.id;
  actionMessage.value = '';
  try {
    const updated = await updateDraft(item.id, { isTemplate: !item.isTemplate });
    if (updated) {
      actionMessage.value = updated.isTemplate ? `「${updated.name}」已存為範本。` : `「${updated.name}」已轉回草稿。`;
      await refresh();
    }
  } finally {
    busyId.value = '';
  }
}

async function removeItem(item: DraftItem) {
  if (!window.confirm(`確定要刪除「${item.name}」嗎？此動作無法復原。`)) return;
  busyId.value = item.id;
  actionMessage.value = '';
  try {
    if (await deleteDraft(item.id)) {
      actionMessage.value = `已刪除「${item.name}」。`;
      await refresh();
    }
  } finally {
    busyId.value = '';
  }
}

onMounted(() => { void refresh(); });
</script>
