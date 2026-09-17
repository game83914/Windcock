<template>
  <div class="mx-auto max-w-md">
    <div class="rounded-2xl border border-[#ded7cb] bg-[#faf8f3] p-6 shadow-[0_8px_28px_rgba(23,23,23,0.10)] sm:p-8">
      <div class="mb-6 text-center">
        <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#171717] text-lg font-black text-white">風</span>
        <h1 class="mt-4 text-2xl font-black tracking-[-0.03em]">手機門號登入</h1>
        <p class="mt-1 text-sm text-[#77716a]">一人一門號、一人一票</p>
      </div>

      <form v-if="!codeSent" class="space-y-4" @submit.prevent="sendCode">
        <div>
          <label class="mb-1 block text-sm font-bold text-[#5f5a53]">手機門號</label>
          <input
            v-model="phone"
            inputmode="numeric"
            placeholder="09xxxxxxxx"
            class="field-input"
            :class="error ? 'field-input-error' : ''"
          />
        </div>
        <UiButton type="submit" variant="action" block size="lg" :disabled="sending">
          {{ sending ? '發送中…' : '取得驗證碼' }}
        </UiButton>
      </form>

      <form v-else class="space-y-4" @submit.prevent="verifyCode">
        <p class="text-sm leading-6 text-[#5f5a53]">已發送 6 位驗證碼至手機。</p>
        <p v-if="devCode" class="rounded-xl border border-[#e6cf9e] bg-[#fff8ec] p-3 text-sm text-[#8f5d14]">
          開發模式驗證碼：<strong class="tracking-widest">{{ devCode }}</strong>
        </p>
        <div>
          <label class="mb-1 block text-sm font-bold text-[#5f5a53]">驗證碼</label>
          <input
            v-model="code"
            inputmode="numeric"
            maxlength="6"
            placeholder="6 位驗證碼"
            class="field-input tracking-widest"
            :class="error ? 'field-input-error' : ''"
          />
        </div>
        <UiButton type="submit" variant="action" block size="lg" :disabled="verifying">
          {{ verifying ? '驗證中…' : '登入' }}
        </UiButton>
        <button type="button" class="w-full text-center text-sm font-bold text-[#5f5a53] hover:text-[#171717]" @click="reset">
          改用其他門號
        </button>
      </form>

      <p v-if="error" class="mt-4 rounded-xl border border-[#e49c8c] bg-[#fbe9e5] p-3 text-sm font-bold text-[#a63222]">{{ error }}</p>
    </div>
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
