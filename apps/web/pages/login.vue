<template>
  <div class="mx-auto max-w-md">
    <div class="rounded-2xl border border-[#ded7cb] bg-[#faf8f3] p-6 shadow-[0_8px_28px_rgba(23,23,23,0.10)] sm:p-8">
      <div class="mb-6 text-center">
        <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#171717] text-lg font-black text-white">風</span>
        <h1 class="mt-4 text-2xl font-black tracking-[-0.03em]">登入</h1>
        <p class="mt-1 text-sm text-[#77716a]">歡迎回來</p>
      </div>

      <form class="space-y-4" @submit.prevent="login">
        <div>
          <label for="login-email" class="mb-1 block text-sm font-bold text-[#5f5a53]">Email</label>
          <input
            id="login-email"
            v-model.trim="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            class="field-input"
            :class="error ? 'field-input-error' : ''"
          />
        </div>
        <div>
          <label for="login-password" class="mb-1 block text-sm font-bold text-[#5f5a53]">密碼</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="請輸入密碼"
            class="field-input"
            :class="error ? 'field-input-error' : ''"
          />
        </div>
        <TurnstileWidget ref="turnstileRef" v-model="turnstileToken" />
        <UiButton type="submit" variant="action" block size="lg" :disabled="logging">
          {{ logging ? '登入中…' : '登入' }}
        </UiButton>
      </form>

      <p class="mt-5 text-center text-sm text-[#5f5a53]">
        還沒有帳號？
        <NuxtLink :to="registerUrl" class="font-bold text-[#d84a36] hover:underline">註冊</NuxtLink>
      </p>
      <p v-if="error" class="mt-4 rounded-xl border border-[#e49c8c] bg-[#fbe9e5] p-3 text-sm font-bold text-[#a63222]">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SessionUser } from '~/stores/auth';
// 明確 import：自動註冊名為 UiTurnstileWidget，模板短名需靠顯式引入解析
import TurnstileWidget from '~/components/ui/TurnstileWidget.vue';

useSeoMeta({ title: '登入｜輿論測風向' });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const email = ref('');
const password = ref('');
const turnstileToken = ref('');
const turnstileRef = ref<{ reset: () => void } | null>(null);
const logging = ref(false);
const error = ref('');

const registerUrl = computed(() => {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  return redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register';
});

async function login() {
  error.value = '';
  if (!EMAIL_RE.test(email.value.trim())) {
    error.value = '請輸入有效的 Email。';
    return;
  }
  if (!password.value) {
    error.value = '請輸入密碼。';
    return;
  }
  logging.value = true;
  try {
    const payload: Record<string, string> = { email: email.value.trim(), password: password.value };
    if (turnstileToken.value) payload.turnstileToken = turnstileToken.value;
    const data = await api.post<{
      accessToken: string;
      user: SessionUser;
    }>('/auth/login', payload);
    auth.setSession(data.accessToken, data.user);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await navigateTo(redirect);
  } catch (e) {
    error.value = errorMessage(e);
    turnstileRef.value?.reset();
  } finally {
    logging.value = false;
  }
}
</script>
