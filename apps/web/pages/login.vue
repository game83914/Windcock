<template>
  <div class="mx-auto max-w-md">
    <h1 class="mb-6 text-2xl font-bold">手機門號登入</h1>

    <form v-if="!codeSent" class="space-y-4" @submit.prevent="sendCode">
      <div>
        <label class="mb-1 block text-sm text-neutral-600">手機門號（09xxxxxxxx）</label>
        <input
          v-model="phone"
          inputmode="numeric"
          placeholder="0912345678"
          class="w-full rounded-lg border border-neutral-300 px-4 py-2"
        />
      </div>
      <button
        type="submit"
        class="w-full rounded-full bg-neutral-900 py-2.5 text-white disabled:opacity-50"
        :disabled="sending"
      >
        {{ sending ? '發送中…' : '取得驗證碼' }}
      </button>
    </form>

    <form v-else class="space-y-4" @submit.prevent="verifyCode">
      <p class="text-sm text-neutral-500">已發送 6 位驗證碼至手機。</p>
      <p v-if="devCode" class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        開發模式驗證碼：<strong class="tracking-widest">{{ devCode }}</strong>
      </p>
      <div>
        <label class="mb-1 block text-sm text-neutral-600">驗證碼</label>
        <input
          v-model="code"
          inputmode="numeric"
          maxlength="6"
          placeholder="6 位驗證碼"
          class="w-full rounded-lg border border-neutral-300 px-4 py-2 tracking-widest"
        />
      </div>
      <button
        type="submit"
        class="w-full rounded-full bg-neutral-900 py-2.5 text-white disabled:opacity-50"
        :disabled="verifying"
      >
        {{ verifying ? '驗證中…' : '登入' }}
      </button>
      <button type="button" class="w-full text-center text-sm text-neutral-500" @click="reset">
        改用其他門號
      </button>
    </form>

    <p v-if="error" class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { SessionUser } from '~/stores/auth';

const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const phone = ref('');
const code = ref('');
const devCode = ref('');
const codeSent = ref(false);
const sending = ref(false);
const verifying = ref(false);
const error = ref('');

async function sendCode() {
  error.value = '';
  sending.value = true;
  try {
    const result = await api.post<{ success: boolean; expireInSeconds: number; devCode?: string }>('/auth/sms/send', {
      phoneNumber: phone.value,
    });
    devCode.value = result.devCode || '';
    if (result.devCode) code.value = result.devCode;
    codeSent.value = true;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    sending.value = false;
  }
}

async function verifyCode() {
  error.value = '';
  verifying.value = true;
  try {
    const data = await api.post<{
      accessToken: string;
      user: SessionUser;
    }>('/auth/sms/verify', { phoneNumber: phone.value, code: code.value });
    auth.setSession(data.accessToken, data.user);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await navigateTo(redirect);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    verifying.value = false;
  }
}

function reset() {
  codeSent.value = false;
  code.value = '';
  devCode.value = '';
}
</script>
