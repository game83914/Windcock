<template>
  <article class="group flex h-full flex-col border border-[#cfc8bc] bg-[#faf8f3]">
    <NuxtLink v-if="linked" :to="`/gifs/${asset.id}`" class="focus-ring block overflow-hidden">
      <GifMedia :asset="asset" class="transition duration-300 group-hover:scale-[1.02]" />
    </NuxtLink>
    <GifMedia v-else :asset="asset" />
    <div class="flex flex-1 flex-col p-4">
      <div class="flex items-start justify-between gap-3">
        <h3 class="font-black leading-snug">{{ asset.title }}</h3>
        <span v-if="showStatus" class="shrink-0 border px-2 py-1 text-[9px] font-black" :class="statusClass">{{ statusLabel }}</span>
      </div>
      <p class="mt-2 flex items-center gap-2 text-[11px] text-[#77716a]"><UserAvatar :nickname="asset.creator.nickname" :avatar-url="asset.creator.avatarUrl" size="sm" />{{ asset.creator.nickname }} · 使用 {{ asset.usageCount }}</p>
      <p v-if="asset.isCreator" class="mt-1 text-[11px] font-bold text-[#3f7a58]">其中 {{ asset.rewardedUseCount }} 次獲得創作者點數</p>
      <p v-if="asset.moderationNote" class="mt-3 border-l-2 border-[#d84a36] pl-2 text-xs text-[#8f3022]">{{ asset.moderationNote }}</p>
      <div class="mt-auto flex items-end justify-between gap-3 pt-4">
        <span class="text-sm font-black text-[#3f7a58]">免費使用</span>
        <button v-if="selectable" type="button" class="focus-ring border px-3 py-2 text-xs font-black disabled:opacity-40" :class="selected ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#171717]'" :disabled="!asset.usable" @click="$emit('select', asset)">{{ selected ? '已選取' : asset.usable ? '選取' : '不可使用' }}</button>
        <slot name="action" />
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { GifAsset } from '~/types/gif';

const props = withDefaults(defineProps<{ asset: GifAsset; linked?: boolean; selectable?: boolean; selected?: boolean; showStatus?: boolean }>(), {
  linked: true,
  selectable: false,
  selected: false,
  showStatus: false,
});
defineEmits<{ select: [asset: GifAsset] }>();

const statusLabel = computed(() => ({ PENDING_REVIEW: '待複核', APPROVED: '已核准', REJECTED: '未通過', TAKEN_DOWN: '已下架' }[props.asset.status] || props.asset.status));
const statusClass = computed(() => props.asset.status === 'APPROVED' ? 'border-[#3f7a58] text-[#3f7a58]' : props.asset.status === 'PENDING_REVIEW' ? 'border-[#9a5b12] text-[#9a5b12]' : 'border-[#d84a36] text-[#a63222]');
</script>
