<template>
  <div v-if="auth.assumptionProfile" class="sticky top-16 z-30 border-b-2 border-[#171717] bg-[#fff0d7] px-4 py-2">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4">
      <p class="text-xs font-black">測試模式：目前模擬「{{ auth.assumptionProfile.label }}」</p>
      <button type="button" class="focus-ring bg-[#171717] px-4 py-2 text-xs font-black text-white" @click="stop">返回管理員身份</button>
    </div>
  </div>
  <div v-else-if="auth.role === 'ADMIN' && profiles.length" class="border-b border-[#b8c3ef] bg-[#e7ecff] px-4 py-2">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2">
      <label class="text-xs font-black" for="dev-identity">測試身份</label>
      <select id="dev-identity" v-model="selected" class="focus-ring min-h-9 border border-[#3157d5] bg-white px-3 text-xs">
        <option value="">選擇身份組</option>
        <option v-for="profile in profiles" :key="profile.key" :value="profile.key">{{ profile.label }}</option>
      </select>
      <button type="button" class="focus-ring min-h-9 bg-[#3157d5] px-4 text-xs font-black text-white disabled:opacity-40" :disabled="!selected || switching" @click="assume">{{ switching ? '切換中…' : '切換' }}</button>
      <span v-if="error" role="alert" class="text-xs font-bold text-[#a63222]">{{ error }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CapabilitySummary, SessionUser } from '~/stores/auth';
interface Profile { key: string; label: string }
const auth = useAuthStore();
const api = useApi();
const profiles = ref<Profile[]>([]);
const selected = ref('');
const switching = ref(false);
const error = ref('');

async function load() {
  if (auth.role !== 'ADMIN' || auth.assumptionProfile) return;
  try { profiles.value = (await api.get<{ profiles: Profile[] }>('/dev/identities')).profiles; }
  catch { profiles.value = []; }
}

async function assume() {
  switching.value = true; error.value = '';
  try {
    const result = await api.post<{ accessToken: string; user: SessionUser; capabilities: CapabilitySummary; assumption: { profileKey: string; label: string } }>('/dev/identities/assume', { profileKey: selected.value });
    auth.beginAssumption(result.accessToken, result.user, { key: result.assumption.profileKey, label: result.assumption.label }, result.capabilities);
    useState('member-dashboard').value = null;
    window.dispatchEvent(new Event('identity-changed'));
    await navigateTo('/');
  } catch (cause) { error.value = errorMessage(cause); }
  finally { switching.value = false; }
}

async function stop() {
  try { await api.post('/dev/identities/release'); } catch { /* A local restore must remain available if the token expired. */ }
  auth.endAssumption();
  useState('member-dashboard').value = null;
  window.dispatchEvent(new Event('identity-changed'));
  await navigateTo('/');
}

onMounted(load);
</script>
