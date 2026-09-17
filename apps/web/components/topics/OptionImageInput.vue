<template>
  <div class="flex items-center gap-2">
    <img v-if="modelValue" :src="modelValue" alt="選項圖片" class="h-16 w-16 shrink-0 rounded-xl border border-[#ded7cb] bg-[#f0e6d2] object-cover cursor-pointer transition hover:opacity-80" @click="$emit('preview', modelValue)" />
    <button v-else type="button" class="focus-ring grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-dashed border-[#cfc8bc] bg-white text-xs font-bold text-[#8b857d] transition hover:border-[#171717]" :disabled="uploading" @click="openPicker">
      <span v-if="uploading" class="size-3.5 animate-spin rounded-full border-2 border-[#8b857d] border-t-transparent" aria-hidden="true" />
      <span v-else>＋圖</span>
    </button>
    <input ref="inputEl" type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" :disabled="uploading" @change="onFile" />
    <button v-if="modelValue" type="button" class="focus-ring shrink-0 rounded-full px-2 text-sm text-[#a63222]" aria-label="移除圖片" @click="emit('update:modelValue', null)">&times;</button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: string | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: string | null]; preview: [src: string] }>();

const api = useApi();
const uploading = ref(false);
const inputEl = shallowRef<HTMLInputElement | null>(null);

function openPicker() {
  inputEl.value?.click();
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    input.value = '';
    return;
  }
  uploading.value = true;
  const form = new FormData();
  form.append('file', file);
  try {
    const result = await api.post<{ imageUrl: string }>('/option-images/upload', form, { timeout: 60000 });
    emit('update:modelValue', result.imageUrl);
  } catch (error) {
    input.value = '';
  } finally {
    uploading.value = false;
    input.value = '';
  }
}
</script>