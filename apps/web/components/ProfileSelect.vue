<template>
  <label class="block">
    <span class="mb-2 block text-sm font-bold">{{ label }}</span>
    <select v-model="model" class="focus-ring w-full border border-[#bfb8ad] bg-white px-4 py-3 text-sm">
      <option value="">未填寫</option>
      <option v-for="item in options" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
  </label>
</template>

<script setup lang="ts">
defineProps<{ label: string; options: ReadonlyArray<{ value: string; label: string }> }>();
const model = defineModel<string>({ required: true });
</script>
