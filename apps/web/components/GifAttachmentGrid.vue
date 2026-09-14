<template>
  <div v-if="attachments.length" class="grid gap-2" :class="attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'">
    <div v-for="asset in attachments" :key="asset.id" class="relative border border-[#d7d1c6] bg-[#ebe6dc]">
      <NuxtLink :to="`/gifs/${asset.id}`" class="focus-ring block"><GifMedia :asset="asset" /></NuxtLink>
      <button v-if="removable" type="button" class="focus-ring absolute right-2 top-2 grid h-7 w-7 place-items-center bg-[#171717] text-lg leading-none text-white" :aria-label="`移除 ${asset.title}`" @click="$emit('remove', asset.id)">&times;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GifAsset } from '~/types/gif';

withDefaults(defineProps<{ attachments: GifAsset[]; removable?: boolean }>(), { removable: false });
defineEmits<{ remove: [id: string] }>();
</script>
