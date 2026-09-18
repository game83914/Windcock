<template>
  <div class="mx-auto max-w-md">
    <div class="rounded-2xl border border-[#ded7cb] bg-[#faf8f3] p-6 shadow-[0_8px_28px_rgba(23,23,23,0.10)] sm:p-8">
      <div class="mb-6 text-center">
        <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#171717] text-lg font-black text-white">風</span>
        <h1 class="mt-4 text-2xl font-black tracking-[-0.03em]">註冊</h1>
        <p class="mt-1 text-sm text-[#77716a]">建立帳號，開始參與投票</p>
      </div>

      <form class="space-y-4" @submit.prevent="register">
        <div>
          <label for="register-email" class="mb-1 block text-sm font-bold text-[#5f5a53]">Email</label>
          <input
            id="register-email"
            v-model.trim="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            class="field-input"
            :class="error ? 'field-input-error' : ''"
          />
        </div>
        <div>
          <label for="register-nickname" class="mb-1 block text-sm font-bold text-[#5f5a53]">暱稱</label>
          <input
            id="register-nickname"
            v-model.trim="nickname"
            type="text"
            autocomplete="nickname"
            minlength="2"
            maxlength="30"
            placeholder="2–30 字"
            class="field-input"
            :class="error ? 'field-input-error' : ''"
          />
        </div>
        <div>
          <label for="register-password" class="mb-1 block text-sm font-bold text-[#5f5a53]">密碼（8 字以上）</label>
          <input
            id="register-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            placeholder="至少 8 字"
            class="field-input"
            :class="error ? 'field-input-error' : ''"
          />
        </div>
        <div>
          <label for="register-password-confirm" class="mb-1 block text-sm font-bold text-[#5f5a53]">確認密碼</label>
          <input
            id="register-password-confirm"
            v-model="passwordConfirm"
            type="password"
            autocomplete="new-password"
            placeholder="再輸入一次密碼"
            class="field-input"
            :class="error ? 'field-input-error' : ''"
          />
        </div>
        <div>
          <label for="register-phone" class="mb-1 block text-sm font-bold text-[#5f5a53]">手機門號（選填）</label>
          <input
            id="register-phone"
            v-model.trim="phone"
            inputmode="numeric"
            autocomplete="tel"
            placeholder="09xxxxxxxx（可不填）"
            class="field-input"
            :class="error ? 'field-input-error' : ''"
          />
        </div>
        <TurnstileWidget ref="turnstileRef" v-model="turnstileToken" />
        <UiButton type="submit" variant="action" block size="lg" :disabled="registering">
          {{ registering ? '註冊中…' : '註冊' }}
        </UiButton>
      </form>

      <p class="mt-5 text-center text-sm text-[#5f5a53]">
        已經有帳號？
        <NuxtLink :to="loginUrl" class="font-bold text-[#d84a36] hover:underline">登入</NuxtLink>
      </p>
      <p v-if="error" class="mt-4 rounded-xl border border-[#e49c8c] bg-[#fbe9e5] p-3 text-sm font-bold text-[#a63222]">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SessionUser } from '~/stores/auth';
// 明確 import：自動註冊名為 UiTurnstileWidget，模板短名需靠顯式引入解析
import TurnstileWidget from '~/components/ui/TurnstileWidget.vue';

useSeoMeta({ title: '註冊｜輿論測風向' });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^09\d{8}$/;

const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const email = ref('');
const nickname = ref('');
const password = ref('');
const passwordConfirm = ref('');
const phone = ref('');
const turnstileToken = ref('');
const turnstileRef = ref<{ reset: () => void } | null>(null);
const registering = ref(false);
const error = ref('');

const loginUrl = computed(() => {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  return redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';
});

async function register() {
  error.value = '';
  if (!EMAIL_RE.test(email.value.trim())) {
    error.value = '請輸入有效的 Email。';
    return;
  }
  if (nickname.value.trim().length < 2) {
    error.value = '暱稱至少需要 2 個字。';
    return;
  }
  if (password.value.length < 8) {
    error.value = '密碼至少需要 8 個字。';
    return;
  }
  if (password.value !== passwordConfirm.value) {
    error.value = '兩次輸入的密碼不一致。';
    return;
  }
  if (phone.value && !PHONE_RE.test(phone.value)) {
    error.value = '手機門號格式為 09xxxxxxxx，不填也可以。';
    return;
  }
  registering.value = true;
  try {
    const payload: Record<string, string> = {
      email: email.value.trim(),
      password: password.value,
      nickname: nickname.value.trim(),
    };
    if (phone.value) payload.phoneNumber = phone.value;
    if (turnstileToken.value) payload.turnstileToken = turnstileToken.value;
    const data = await api.post<{
      accessToken: string;
      user: SessionUser;
    }>('/auth/register', payload);
    auth.setSession(data.accessToken, data.user);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await navigateTo(redirect);
  } catch (e) {
    error.value = errorMessage(e);
    turnstileRef.value?.reset();
  } finally {
    registering.value = false;
  }
}
</script>
