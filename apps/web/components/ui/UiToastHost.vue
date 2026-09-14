<template>
  <Teleport to="body">
    <div aria-live="polite" class="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold shadow-lg"
          :class="toastClass(toast.type)"
        >
          <span class="min-w-0 flex-1">{{ toast.message }}</span>
          <button
            v-if="toast.hasUndo && toast.onUndo"
            type="button"
            class="focus-ring shrink-0 text-xs font-black underline underline-offset-2"
            :class="toast.type === 'success' ? 'text-[#2f6547]' : 'text-[#3157d5]'"
            @click="applyUndo(toast)"
          >復原</button>
          <button
            type="button"
            class="focus-ring shrink-0 text-[#8b857d] hover:text-[#171717]"
            aria-label="關閉通知"
            @click="dismiss(toast.id)"
          >&times;</button>
        </div>
      </TransitionGroup>
    </div>

    <Teleport to="body">
      <Transition name="confirm">
        <div
          v-for="confirm in confirms"
          :key="confirm.id"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-[#171717]/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`confirm-title-${confirm.id}`"
          @click.self="resolveConfirm(confirm.id, false)"
          @keydown.esc="resolveConfirm(confirm.id, false)"
        >
          <div class="w-full max-w-sm rounded-2xl border border-[#ded7cb] bg-[#faf8f3] p-6 shadow-2xl">
            <div
              class="grid h-10 w-10 place-items-center rounded-full text-lg font-black text-white"
              :class="confirm.danger ? 'bg-[#d84a36]' : 'bg-[#3157d5]'"
            >{{ confirm.danger ? '!' : '?' }}</div>
            <h2 :id="`confirm-title-${confirm.id}`" class="mt-4 text-lg font-black">{{ confirm.title }}</h2>
            <p v-if="confirm.message" class="mt-2 text-sm leading-6 text-[#5f5a53]">{{ confirm.message }}</p>
            <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <UiButton variant="outline" @click="resolveConfirm(confirm.id, false)">
                {{ confirm.cancelText || '取消' }}
              </UiButton>
              <UiButton :variant="confirm.danger ? 'action' : 'data'" @click="resolveConfirm(confirm.id, true)">
                {{ confirm.confirmText || '確定' }}
              </UiButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </Teleport>
</template>

<script setup lang="ts">
import type { ToastItem } from '~/composables/useToast';

const { toasts, confirms, dismiss, resolveConfirm } = useToast();

function toastClass(type: ToastItem['type']) {
  return {
    default: 'border-[#d7d1c6] bg-[#171717] text-white',
    success: 'border-[#b7d4c0] bg-[#e5f1e9] text-[#2f6547]',
    error: 'border-[#e49c8c] bg-[#fbe9e5] text-[#a63222]',
    info: 'border-[#b7c6ee] bg-[#e7ecff] text-[#2746b4]',
  }[type];
}

async function applyUndo(toast: ToastItem) {
  dismiss(toast.id);
  if (toast.onUndo) await toast.onUndo();
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.2s ease;
}
.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}
</style>