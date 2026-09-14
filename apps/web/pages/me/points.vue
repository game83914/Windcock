<template>
  <div>
    <header class="border-b-2 border-[#171717] pb-5"><p class="eyebrow text-[#3157d5]">點數帳本</p><h1 class="mt-1 text-2xl font-black">取得與使用紀錄</h1></header>
    <p v-if="pageError" class="mt-5 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm text-[#a63222]">{{ pageError }}</p>
    <div v-if="loading" class="mt-5 h-56 animate-pulse bg-[#e5e0d6]" />
    <template v-else-if="data">
      <div class="mt-5 border-l-4 border-[#3157d5] bg-[#e7ecff] p-5"><small class="font-black text-[#5f5a53]">目前可用</small><strong class="mt-1 block text-3xl tabular-nums text-[#3157d5]">{{ data.balance }} 點</strong></div>
      <div class="mt-5 divide-y divide-[#d7d1c6] border border-[#d7d1c6] bg-white">
        <article v-for="item in data.items" :key="item.id" class="flex items-center justify-between gap-4 p-4"><div><strong class="text-sm">{{ item.note || typeLabel(item.txType) }}</strong><p class="mt-1 text-xs text-[#77716a]">{{ new Date(item.createdAt).toLocaleString('zh-TW') }} · 餘額 {{ item.balanceAfter }}</p></div><strong class="shrink-0 tabular-nums" :class="Number(item.amount) >= 0 ? 'text-[#3f7a58]' : 'text-[#d84a36]'">{{ Number(item.amount) >= 0 ? '+' : '' }}{{ item.amount }}</strong></article>
        <p v-if="!data.items.length" class="p-8 text-center text-sm text-[#77716a]">尚無點數紀錄。</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '點數帳本｜會員中心' });
interface PointHistory { balance: string; items: Array<{ id: string; amount: string; balanceAfter: string; txType: string; note: string | null; createdAt: string }> }
const api = useApi(); const data = ref<PointHistory | null>(null); const loading = ref(true); const pageError = ref('');
const labels: Record<string, string> = { VOTE_REWARD: '投票獎勵', MEME_USAGE_REWARD: 'GIF 使用獎勵' };
function typeLabel(value: string) { return labels[value] || value; }
onMounted(async () => { try { data.value = await api.get<PointHistory>('/me/points'); } catch (cause) { pageError.value = errorMessage(cause); } finally { loading.value = false; } });
</script>
