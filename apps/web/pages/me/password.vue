<template>
  <div>
    <div class="mb-8 border-b-2 border-[#171717] pb-6">
      <h2 class="text-3xl font-black tracking-[-0.04em]">修改密碼</h2>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-[#6d6861]">輸入舊密碼與新密碼（8 字以上）即可更新登入密碼。</p>
    </div>

    <form class="max-w-md space-y-5 border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:p-7" @submit.prevent="changePassword">
      <label class="block">
        <span class="mb-2 block text-sm font-bold">舊密碼</span>
        <input
          v-model="oldPassword"
          type="password"
          autocomplete="current-password"
          placeholder="請輸入舊密碼"
          class="focus-ring w-full border border-[#bfb8ad] bg-white px-4 py-3 text-sm"
        />
      </label>
      <label class="block">
        <span class="mb-2 block text-sm font-bold">新密碼（8 字以上）</span>
        <input
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          placeholder="至少 8 字"
          class="focus-ring w-full border border-[#bfb8ad] bg-white px-4 py-3 text-sm"
        />
      </label>
      <label class="block">
        <span class="mb-2 block text-sm font-bold">確認新密碼</span>
        <input
          v-model="newPasswordConfirm"
          type="password"
          autocomplete="new-password"
          placeholder="再輸入一次新密碼"
          class="focus-ring w-full border border-[#bfb8ad] bg-white px-4 py-3 text-sm"
        />
      </label>
      <p v-if="message" class="border-l-4 p-4 text-sm" :class="messageError ? 'border-[#d84a36] bg-[#fbe9e5] text-[#a63222]' : 'border-[#3f7a58] bg-[#e5f1e9] text-[#315f44]'">{{ message }}</p>
      <button type="submit" class="focus-ring bg-[#171717] px-7 py-3 text-sm font-black text-white disabled:opacity-50" :disabled="saving">
        {{ saving ? '更新中…' : '更新密碼' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '修改密碼｜會員中心' });

const api = useApi();
const oldPassword = ref('');
const newPassword = ref('');
const newPasswordConfirm = ref('');
const saving = ref(false);
const message = ref('');
const messageError = ref(false);

async function changePassword() {
  message.value = '';
  if (!oldPassword.value) {
    messageError.value = true;
    message.value = '請輸入舊密碼。';
    return;
  }
  if (newPassword.value.length < 8) {
    messageError.value = true;
    message.value = '新密碼至少需要 8 個字。';
    return;
  }
  if (newPassword.value !== newPasswordConfirm.value) {
    messageError.value = true;
    message.value = '兩次輸入的新密碼不一致。';
    return;
  }
  saving.value = true;
  try {
    await api.post('/auth/password/change', { oldPassword: oldPassword.value, newPassword: newPassword.value });
    messageError.value = false;
    message.value = '密碼已更新，下次請用新密碼登入。';
    oldPassword.value = '';
    newPassword.value = '';
    newPasswordConfirm.value = '';
  } catch (error) {
    messageError.value = true;
    message.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
}
</script>
