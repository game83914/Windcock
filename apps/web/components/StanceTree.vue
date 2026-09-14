<template>
  <section data-stance-tree class="border-2 border-[#171717] bg-[#faf8f3] shadow-[6px_6px_0_#d7d1c6]">
    <header class="flex flex-col gap-4 border-b border-[#d7d1c6] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
      <div>
        <p class="eyebrow text-[#d84a36]">立場探索器</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div v-if="showViewControl" role="group" aria-label="立場視圖" class="hidden border-2 border-[#171717] bg-white lg:flex">
          <button
            v-for="item in viewOptions"
            :key="item.value"
            type="button"
            class="focus-ring min-h-11 px-4 text-sm font-black"
            :class="viewMode === item.value ? 'bg-[#171717] text-white' : 'text-[#55514c]'"
            :aria-pressed="viewMode === item.value"
            @click="viewMode = item.value"
          >
            {{ item.label }}
          </button>
        </div>
        <button
          v-if="canPropose && open"
          type="button"
          class="focus-ring min-h-11 shrink-0 bg-[#3157d5] px-5 py-2 text-sm font-black text-white"
          @click="openProposal(null)"
        >
          ＋ 提出立場
        </button>
      </div>
    </header>

    <div class="p-4 sm:p-6">
      <p v-if="open && ['PARTNER', 'STAFF'].includes(participationMode)" class="mb-5 border-l-4 border-[#9a5b12] bg-[#fff0d7] p-4 text-sm">
        此身份僅供工作或資訊查閱，不能表態、討論或提出立場。
      </p>

      <p v-if="error" role="alert" class="mb-4 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-3 text-sm font-bold text-[#a63222]">{{ error }}</p>
      <p v-if="actionMessage" role="status" class="mb-4 border-l-4 p-3 text-sm font-bold" :class="actionOk ? 'border-[#3f7a58] bg-[#e5f1e9] text-[#2f6547]' : 'border-[#d84a36] bg-[#fbe9e5] text-[#a63222]'">{{ actionMessage }}</p>
      <div v-if="loading" role="status" class="grid gap-3 sm:grid-cols-3">
        <div v-for="item in 3" :key="item" class="h-24 animate-pulse bg-[#e5e0d6]" />
      </div>
      <p v-else-if="tree?.count === 0 && !privateApplications.length" class="py-8 text-center text-sm text-[#5f5a53]">還沒有立場節點，歡迎新增第一個立場。</p>

      <template v-if="tree">
        <div class="lg:grid lg:gap-6" :class="stanceGridClass">
          <aside v-if="viewMode === 'TREE'" class="hidden border-r border-[#d7d1c6] pr-5 lg:block">
            <div class="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain">
              <label class="mb-4 block border-b border-[#d7d1c6] pb-4">
                <span class="sr-only">搜尋立場</span>
                <input v-model.trim="query" type="search" placeholder="搜尋立場或理由…" class="focus-ring min-h-10 w-full border border-[#bfb8ad] bg-white px-3 text-sm" />
              </label>
              <p class="mb-3 text-xs font-black tracking-wide text-[#77716a]">{{ showingResults ? `搜尋結果 ${filteredNodes.length}` : '立場' }}</p>
              <ul v-if="showingResults" class="space-y-1">
                <li v-for="node in filteredNodes" :key="node.id">
                  <button type="button" class="focus-ring block w-full border-l-2 p-3 text-left" :class="selectedId === node.id ? 'border-[#3157d5] bg-[#e7ecff]' : 'border-transparent hover:bg-[#ebe6dc]'" @click="selectNode(node.id)">
                    <span class="line-clamp-2 text-sm font-bold">{{ node.title }}</span>
                    <span class="mt-1 block text-[10px] text-[#77716a]">{{ pathLabel(node) }}</span>
                  </button>
                </li>
              </ul>
              <p v-if="showingResults && !filteredNodes.length" class="py-6 text-center text-xs text-[#77716a]">找不到符合的立場。</p>
              <ul v-else>
                <li v-for="application in rootPrivateApplications" :key="`application-${application.id}`">
                  <button type="button" class="focus-ring my-1 block w-full border-2 border-dashed border-[#9a958d] bg-[#efede8] p-3 text-left" :class="selectedApplicationId === application.id ? 'shadow-[inset_4px_0_0_#6d6861]' : ''" @click="selectApplication(application)">
                    <span class="block text-[10px] font-black text-[#77716a]">你的提案 · {{ applicationStatusLabel(application) }}</span>
                    <span class="mt-1 block text-sm font-bold text-[#55514c]">{{ application.title }}</span>
                  </button>
                </li>
                <StanceTreeNavNode v-for="root in tree.roots" :key="root.id" :node="root" :selected-id="selectedId" @select="selectNode" />
              </ul>
            </div>
          </aside>

          <section v-else class="hidden min-w-0 lg:block">
            <div class="flex items-center justify-between gap-4">
              <p class="text-sm font-black">{{ mapLabel }}<span class="ml-2 text-xs font-normal text-[#77716a]">點選節點，右側顯示詳細立場</span></p>
              <div class="flex shrink-0 items-center gap-3">
                <label class="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#5f5a53]">
                  <input v-model="showAllDepth" type="checkbox" class="h-4 w-4 accent-[#3157d5]" />
                  顯示全部深度
                </label>
                <button type="button" class="focus-ring min-h-9 border-2 border-[#171717] bg-white px-3 text-xs font-black text-[#55514c] hover:bg-[#ebe6dc]" @click="mapResetKey++">重置視圖</button>
              </div>
            </div>
            <div class="mt-3 h-[560px] border-2 border-[#171717] bg-white">
              <LazyStanceMap
                :mode="mapMode"
                :tree="tree"
                :topic-title="topicTitle"
                :selected-id="selectedId"
                :show-all-depth="showAllDepth"
                :reset-key="mapResetKey"
                @select="selectNode"
              />
            </div>
          </section>

          <main class="min-w-0">
            <div class="lg:hidden">
              <label v-if="showingResults || (!selectedNode && !selectedApplication)" class="mb-4 block border-b border-[#d7d1c6] pb-4">
                <span class="sr-only">搜尋立場</span>
                <input v-model.trim="query" type="search" placeholder="搜尋立場或理由…" class="focus-ring min-h-10 w-full border border-[#bfb8ad] bg-white px-3 text-sm" />
              </label>
              <div v-if="showingResults" class="mb-4">
                <p class="mb-2 text-xs font-black text-[#77716a]">搜尋結果 {{ filteredNodes.length }}</p>
                <div class="grid gap-2">
                  <button v-for="node in filteredNodes" :key="node.id" type="button" class="focus-ring border border-[#d7d1c6] bg-white p-3 text-left" @click="selectNode(node.id)">
                    <span class="block text-sm font-black">{{ node.title }}</span>
                    <span class="mt-1 block text-[10px] text-[#77716a]">{{ pathLabel(node) }}</span>
                  </button>
                </div>
                <p v-if="!filteredNodes.length" class="py-6 text-center text-xs text-[#77716a]">找不到符合的立場。</p>
              </div>
              <div v-else-if="!selectedNode && !selectedApplication" class="grid gap-2">
                <button v-for="application in rootPrivateApplications" :key="`application-${application.id}`" type="button" class="focus-ring flex items-center justify-between gap-3 border-2 border-dashed border-[#9a958d] bg-[#efede8] p-4 text-left" @click="selectApplication(application)">
                  <span><small class="block font-black text-[#77716a]">你的提案 · {{ applicationStatusLabel(application) }}</small><strong class="mt-1 block text-[#55514c]">{{ application.title }}</strong></span><span aria-hidden="true">→</span>
                </button>
                <button v-for="root in tree.roots" :key="root.id" type="button" class="focus-ring flex items-center justify-between gap-3 border border-[#d7d1c6] bg-white p-4 text-left" @click="selectNode(root.id)">
                  <span><strong class="block leading-5">{{ root.title }}</strong><small class="mt-1 block text-[#77716a]">{{ countDescendants(root) }} 個衍生立場</small></span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>

            <div v-if="selectedApplication" class="border-2 border-[#171717] bg-white">
              <div class="flex border-b border-[#d7d1c6]">
                <span class="flex-1 bg-[#171717] px-4 py-3 text-center text-sm font-black text-white">立場內容</span>
                <span class="flex-1 bg-[#efede8] px-4 py-3 text-center text-sm font-black text-[#9a958d]">討論尚未開放</span>
              </div>
              <div class="p-5 sm:p-6">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="bg-[#77716a] px-2 py-1 text-[11px] font-black text-white">私人預覽 · {{ applicationStatusLabel(selectedApplication) }}</span>
                  <button type="button" class="focus-ring min-h-10 px-2 text-xs font-black text-[#3157d5]" @click="returnPrevious">&larr; 返回上一層</button>
                </div>

                <form v-if="editingPrivate" class="mt-3 grid gap-4" @submit.prevent="savePrivateApplication(selectedApplication)">
                  <label class="text-xs font-black">立場內容<input v-model="privateDraft.title" maxlength="80" class="focus-ring mt-1 min-h-11 w-full border-2 border-[#171717] bg-white px-3 text-base font-black" /></label>
                  <label class="text-xs font-black">理由說明<textarea v-model="privateDraft.rationale" maxlength="200" rows="4" class="focus-ring mt-1 w-full border border-[#bfb8ad] bg-white p-3 text-sm" /></label>
                  <div class="flex justify-end gap-2"><button type="button" class="focus-ring min-h-11 px-4 text-sm" @click="cancelPrivateEdit">取消編輯</button><button class="focus-ring min-h-11 bg-[#171717] px-5 text-sm font-black text-white disabled:opacity-40" :disabled="savingPrivate || privateDraft.title.trim().length < 2 || Boolean(selectedApplication.target.blockedReason)">{{ savingPrivate ? '儲存中…' : selectedApplication.status === 'REJECTED' ? '修改並重新送審' : '儲存修改' }}</button></div>
                </form>

                <template v-else>
                  <h3 class="mt-3 text-2xl font-black leading-tight">{{ selectedApplication.title }}</h3>
                  <p v-if="selectedApplication.rationale" class="mt-3 leading-7 text-[#5f5a53]">{{ selectedApplication.rationale }}</p>
                  <p class="mt-3 text-xs text-[#77716a]">你的立場提案 · 尚未公開</p>
                  <p v-if="selectedApplication.reviewNote" class="mt-3 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-3 text-sm text-[#a63222]">小組回覆：{{ selectedApplication.reviewNote }}</p>
                  <p v-if="selectedApplication.target.blockedReason" class="mt-3 text-sm font-bold text-[#a63222]">{{ selectedApplication.target.blockedReason }}</p>

                  <div class="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button type="button" class="min-h-11 cursor-not-allowed border border-[#cfc8bc] px-4 text-sm font-black text-[#9a958d]" disabled>我認同 0</button>
                    <button type="button" class="min-h-11 cursor-not-allowed border border-[#cfc8bc] px-4 text-sm font-black text-[#9a958d]" disabled>我不認同 0</button>
                  </div>
                  <p class="mt-2 text-xs text-[#77716a]">正式發布後才會開放表態與討論。</p>

                  <div class="mt-6 flex flex-wrap justify-between gap-3 border-t border-[#d7d1c6] pt-4">
                    <button type="button" class="focus-ring min-h-11 border border-[#d84a36] px-4 text-sm font-black text-[#a63222] disabled:opacity-40" :disabled="withdrawing" @click="withdrawPrivateApplication(selectedApplication)">{{ withdrawing ? '取消中…' : '取消這筆提案' }}</button>
                    <button v-if="selectedApplication.target.canEdit || selectedApplication.target.canResubmit" type="button" class="focus-ring min-h-11 bg-[#3157d5] px-5 text-sm font-black text-white" @click="startPrivateEdit(selectedApplication)">{{ selectedApplication.status === 'REJECTED' ? '修改並重新送審' : '編輯內容' }}</button>
                  </div>
                </template>
              </div>
            </div>

            <div v-else-if="selectedNode" class="border-2 border-[#171717] bg-white">
              <div class="flex border-b border-[#d7d1c6]">
                <button type="button" class="focus-ring flex-1 px-4 py-3 text-sm font-black" :class="detailTab === 'DETAIL' ? 'bg-[#171717] text-white' : ''" @click="selectDetailTab('DETAIL')">立場內容</button>
                <button type="button" class="focus-ring flex-1 px-4 py-3 text-sm font-black" :class="detailTab === 'DISCUSSION' ? 'bg-[#171717] text-white' : ''" @click="selectDetailTab('DISCUSSION')">討論 {{ selectedNode.discussionCount }}</button>
              </div>

              <div v-if="detailTab === 'DETAIL'" class="p-5 sm:p-6">
                <div>
                  <button
                    type="button"
                    class="focus-ring min-h-10 px-2 text-xs font-black text-[#3157d5]"
                    :title="parentNode?.title || '全部立場'"
                    :aria-label="parentNode ? `返回上一層：${parentNode.title}` : '返回全部立場'"
                    @click="returnPrevious"
                  >
                    &larr; 返回上一層
                  </button>
                </div>
                <h3 class="mt-3 text-2xl font-black leading-tight">{{ selectedNode.title }}</h3>
                <p v-if="selectedNode.rationale" class="mt-3 leading-7 text-[#5f5a53]">{{ selectedNode.rationale }}</p>
                <p class="mt-3 text-xs text-[#77716a]">議題小組整理 · {{ formatTime(selectedNode.createdAt) }}</p>
                <p v-if="selectedNode.proposedBy.length" class="mt-1 text-xs text-[#77716a]">提案參與者：{{ selectedNode.proposedBy.map((person) => person.label).join('、') }}</p>

                <div class="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                   <button type="button" class="focus-ring min-h-11 border px-4 text-sm font-black disabled:opacity-40" :class="selectedNode.mySignals.includes('AGREE') ? 'border-[#3f7a58] bg-[#e5f1e9] text-[#2f6547]' : 'border-[#cfc8bc]'" :aria-pressed="selectedNode.mySignals.includes('AGREE')" :disabled="!authed || !open || !auth.canSignal || toggling !== null" @click="toggleSignal('AGREE')">我認同 {{ selectedNode.agreed }}</button>
                   <button type="button" class="focus-ring min-h-11 border px-4 text-sm font-black disabled:opacity-40" :class="selectedNode.mySignals.includes('DISAGREE') ? 'border-[#d84a36] bg-[#fbe9e5] text-[#a63222]' : 'border-[#cfc8bc]'" :aria-pressed="selectedNode.mySignals.includes('DISAGREE')" :disabled="!authed || !open || !auth.canSignal || toggling !== null" @click="toggleSignal('DISAGREE')">我不認同 {{ selectedNode.disagreed }}</button>
                </div>

                <section v-if="selectedNode.children.length || selectedPrivateApplications.length" class="mt-6 border-t border-[#d7d1c6] pt-5">
                  <h4 class="text-sm font-black">衍生立場（{{ selectedNode.children.length + selectedPrivateApplications.length }}）</h4>
                  <div class="mt-2 grid gap-2">
                    <button v-for="child in selectedNode.children" :key="child.id" type="button" class="focus-ring flex min-h-11 items-center justify-between gap-3 border border-[#d7d1c6] bg-[#faf8f3] p-3 text-left hover:border-[#171717]" @click="selectNode(child.id)">
                      <span><strong class="block text-sm">{{ child.title }}</strong><small class="mt-1 block text-[#77716a]">{{ child.agreed }} 認同 · {{ child.children.length }} 個直接衍生</small></span><span aria-hidden="true">→</span>
                    </button>
                    <button v-for="application in selectedPrivateApplications" :key="`application-${application.id}`" type="button" class="focus-ring flex min-h-11 items-center justify-between gap-3 border-2 border-dashed border-[#9a958d] bg-[#efede8] p-3 text-left" @click="selectApplication(application)">
                      <span><strong class="block text-sm text-[#55514c]">{{ application.title }}</strong><small class="mt-1 block font-bold text-[#77716a]">你的提案 · {{ applicationStatusLabel(application) }}</small></span><span aria-hidden="true">→</span>
                    </button>
                  </div>
                </section>

                <div v-if="canPropose && open && selectedNode.depth < (tree?.maxDepth ?? 4)" class="mt-6 border-t border-[#d7d1c6] pt-4">
                  <button type="button" class="focus-ring min-h-11 text-sm font-black text-[#3157d5]" @click="openProposal(selectedNode)">＋ 延伸這個立場</button>
                </div>

                <div class="mt-5 text-right">
                  <NuxtLink v-if="!authed" :to="loginUrl" class="focus-ring text-xs font-bold text-[#77716a]">登入後可檢舉內容</NuxtLink>
                   <button v-else-if="auth.canReport" type="button" class="focus-ring min-h-10 px-2 text-xs font-bold text-[#77716a] hover:text-[#d84a36]" @click="showReport = !showReport">檢舉此立場</button>
                   <span v-else class="text-xs text-[#77716a]">檢舉功能限資深一般會員</span>
                  <form v-if="showReport && authed && auth.canReport" class="mt-2 grid gap-3 border border-[#d7d1c6] bg-[#faf8f3] p-4 text-left" @submit.prevent="submitReport">
                    <label class="text-xs font-black" for="stance-report-reason">檢舉原因</label>
                    <select id="stance-report-reason" v-model="reportReason" class="focus-ring min-h-11 border border-[#bfb8ad] bg-white px-3 text-sm">
                      <option value="HARASSMENT">騷擾或不當言論</option><option value="INAPPROPRIATE">內容不適當</option><option value="FALSE_INFO">不實資訊</option><option value="OTHER">其他</option>
                    </select>
                    <label class="text-xs font-black" for="stance-report-detail">補充說明（選填）</label>
                    <textarea id="stance-report-detail" v-model="reportDetail" maxlength="2000" rows="2" class="focus-ring border border-[#bfb8ad] bg-white p-3 text-sm" />
                    <button class="focus-ring min-h-11 bg-[#171717] px-5 text-sm font-black text-white disabled:opacity-50" :disabled="reporting">{{ reporting ? '送出中…' : '送出檢舉' }}</button>
                  </form>
                </div>
              </div>

              <Discussion v-else :topic-id="topicId" :authed="authed" :open="open" :can-interact="auth.canDiscuss" :stance-id="selectedNode.id" :stance-title="selectedNode.title" @clear-stance="clearSelection" />
            </div>
            </main>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <div v-if="proposalOpen" class="fixed inset-0 z-50 bg-black/45" @click.self="closeProposal">
        <aside role="dialog" aria-modal="true" aria-labelledby="stance-proposal-title" class="ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto bg-[#faf8f3] shadow-[-8px_0_0_rgba(23,23,23,0.18)]">
          <header class="sticky top-0 z-10 flex items-start justify-between gap-4 border-b-2 border-[#171717] bg-[#faf8f3] p-5 sm:p-6">
            <div><p class="eyebrow text-[#3157d5]">{{ proposalParent ? '衍生立場' : '立場' }}</p><h2 id="stance-proposal-title" class="mt-1 text-2xl font-black">{{ proposalParent ? '延伸這個立場' : '提出立場' }}</h2></div>
            <button type="button" class="focus-ring min-h-10 px-3 text-sm font-black" aria-label="關閉提案面板" @click="closeProposal">關閉</button>
          </header>
          <div class="flex-1 p-5 sm:p-6">
            <section class="border-l-4 border-[#3157d5] bg-[#e7ecff] p-4">
              <p class="text-[11px] font-black tracking-wide text-[#3157d5]">正在回應</p>
              <p class="mt-1 font-black">{{ proposalParent ? proposalParent.title : topicTitle }}</p>
              <p class="mt-3 text-xs font-bold text-[#5f5a53]">發布後位置</p>
              <p class="mt-1 text-sm leading-6 text-[#5f5a53]">{{ proposalPlacement }}</p>
            </section>
            <p v-if="proposalError" role="alert" class="mt-4 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-3 text-sm font-bold text-[#a63222]">{{ proposalError }}</p>

            <form class="mt-5 grid gap-4" @submit.prevent="addStance">
              <label class="text-sm font-black" for="proposal-stance-title">立場內容</label>
              <input id="proposal-stance-title" ref="proposalTitleInput" v-model="proposalTitle" maxlength="80" placeholder="用一句話說清楚你的立場（2–80 字）" class="focus-ring min-h-12 border-2 border-[#171717] bg-white px-4 text-sm" />
              <label class="text-sm font-black" for="proposal-stance-rationale">為什麼這樣認為？ <span class="font-normal text-[#77716a]">選填</span></label>
              <textarea id="proposal-stance-rationale" v-model="proposalRationale" maxlength="200" rows="4" class="focus-ring border border-[#bfb8ad] bg-white p-4 text-sm" />
              <AiAuthoringWizard
                target="STANCE"
                :topic-id="topicId"
                :parent-id="proposalParent?.id"
                :form-context="{ title: proposalTitle, rationale: proposalRationale }"
                :has-existing-content="Boolean(proposalTitle || proposalRationale)"
                @apply="applyProposalDraft"
              />
              <div class="border-t border-[#d7d1c6] pt-4">
                <p class="text-xs text-[#6d6861]">送出後，議題小組可能整理文字、與其他提案整併，或說明未採用原因。</p>
                <button class="focus-ring mt-3 min-h-12 w-full bg-[#3157d5] px-5 text-sm font-black text-white disabled:opacity-40" :disabled="adding || proposalTitle.trim().length < 2">{{ adding ? '送出中…' : proposalParent ? '送出衍生立場提案' : '送出立場提案' }}</button>
              </div>
            </form>
          </div>
        </aside>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import type { StanceNode, StanceSignal, StanceTreeResponse } from '~/types/topic';
import type { StanceAuthoringForm, TopicAuthoringForm } from '~/types/authoring';
import type { StanceApplication } from '~/types/application';

type DetailTab = 'DETAIL' | 'DISCUSSION';
type StanceViewMode = 'TREE' | 'MIND' | 'CONSTELLATION';

const props = defineProps<{ topicId: string; topicTitle: string; authed: boolean; open: boolean; selected?: string | null; tab?: DetailTab }>();
const emit = defineEmits<{ select: [stanceId: string | null]; tab: [tab: DetailTab] }>();
const api = useApi();
const auth = useAuthStore();
const tree = ref<StanceTreeResponse | null>(null);
const loading = ref(true);
const error = ref('');
const selectedId = ref<string | null>(props.selected ?? null);
const selectedApplicationId = ref<string | null>(null);
const query = ref('');
const detailTab = ref<DetailTab>(props.tab ?? 'DETAIL');
const viewMode = ref<StanceViewMode>('TREE');
const showAllDepth = ref(false);
const mapResetKey = ref(0);
const toggling = ref<StanceSignal | null>(null);
const adding = ref(false);
const proposalOpen = ref(false);
const proposalParent = ref<StanceNode | null>(null);
const proposalTitle = ref('');
const proposalRationale = ref('');
const proposalError = ref('');
const proposalTitleInput = ref<HTMLInputElement | null>(null);
const showReport = ref(false);
const reporting = ref(false);
const reportReason = ref('HARASSMENT');
const reportDetail = ref('');
const actionMessage = ref('');
const actionOk = ref(false);
const privateApplications = ref<StanceApplication[]>([]);
const privateDraft = reactive({ title: '', rationale: '' });
const editingPrivate = ref(false);
const savingPrivate = ref(false);
const withdrawing = ref(false);
const loginUrl = computed(() => `/login?redirect=${encodeURIComponent(`/topic/${props.topicId}?section=stances`)}`);

const allNodes = computed(() => flatten(tree.value?.roots ?? []));
const nodeMap = computed(() => new Map(allNodes.value.map((node) => [node.id, node])));
const selectedNode = computed(() => selectedId.value ? nodeMap.value.get(selectedId.value) ?? null : null);
const selectedApplication = computed(() => selectedApplicationId.value ? privateApplications.value.find((application) => application.id === selectedApplicationId.value) ?? null : null);
const parentNode = computed(() => selectedNode.value?.parentId ? nodeMap.value.get(selectedNode.value.parentId) ?? null : null);
const showingResults = computed(() => query.value.length > 0);
const viewOptions: Array<{ value: StanceViewMode; label: string }> = [
  { value: 'TREE', label: '列表' },
  { value: 'MIND', label: '心智圖' },
  { value: 'CONSTELLATION', label: '星空圖' },
];
const showViewControl = computed(() => (tree.value?.roots.length ?? 0) > 0);
const mapMode = computed<Exclude<StanceViewMode, 'TREE'>>(() => (viewMode.value === 'TREE' ? 'MIND' : viewMode.value));
const mapLabel = computed(() => `${mapMode.value === 'MIND' ? '心智圖' : '星空圖'} · ${tree.value?.count ?? 0} 個立場`);
const stanceGridClass = computed(() => viewMode.value === 'TREE' || !(tree.value?.roots.length)
  ? 'lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]'
  : 'lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]');
const canPropose = computed(() => props.authed && Boolean(auth.capabilitySummary?.participation?.canSubmitStanceApplication));
const participationMode = computed(() => auth.capabilitySummary?.participation?.mode ?? 'MEMBER');
const rootPrivateApplications = computed(() => privateApplications.value.filter((application) => !application.parentStanceId));
const selectedPrivateApplications = computed(() => privateApplications.value.filter((application) => application.parentStanceId === selectedId.value));
const proposalPlacement = computed(() => proposalParent.value
  ? [props.topicTitle, ...pathNodes(proposalParent.value).map((node) => node.title), '新衍生立場'].join(' / ')
  : `${props.topicTitle} / 新立場`);
const filteredNodes = computed(() => {
  const keyword = query.value.toLocaleLowerCase('zh-TW');
  return allNodes.value.filter((node) => `${node.title} ${node.rationale ?? ''}`.toLocaleLowerCase('zh-TW').includes(keyword));
});
watch(() => props.selected, (value) => { selectedApplicationId.value = null; selectedId.value = value ?? null; });
watch(() => props.tab, (value) => { detailTab.value = value ?? 'DETAIL'; });
watch(() => props.topicId, () => { viewMode.value = 'TREE'; showAllDepth.value = false; selectedId.value = null; selectedApplicationId.value = null; query.value = ''; detailTab.value = props.tab ?? 'DETAIL'; Promise.all([load(), loadPrivateApplications()]); });
watch(selectedId, () => {
  showReport.value = false;
  actionMessage.value = '';
});
watch(proposalOpen, (open) => {
  if (!import.meta.client) return;
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) nextTick(() => proposalTitleInput.value?.focus());
});

function flatten(nodes: StanceNode[]): StanceNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    tree.value = await api.get<StanceTreeResponse>(`/topics/${props.topicId}/stances`);
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    loading.value = false;
  }
}

async function loadPrivateApplications() {
  if (!props.authed) { privateApplications.value = []; return; }
  try { privateApplications.value = await api.get<StanceApplication[]>(`/topics/${props.topicId}/stance-applications/mine`); }
  catch { privateApplications.value = []; }
}

function selectApplication(application: StanceApplication) {
  selectedApplicationId.value = application.id;
  selectedId.value = null;
  detailTab.value = 'DETAIL';
  editingPrivate.value = false;
  Object.assign(privateDraft, { title: application.title, rationale: application.rationale || '' });
  emit('select', null);
}

function startPrivateEdit(application: StanceApplication) {
  Object.assign(privateDraft, { title: application.title, rationale: application.rationale || '' });
  editingPrivate.value = true;
}

function cancelPrivateEdit() {
  if (selectedApplication.value) Object.assign(privateDraft, { title: selectedApplication.value.title, rationale: selectedApplication.value.rationale || '' });
  editingPrivate.value = false;
}

async function savePrivateApplication(application: StanceApplication) {
  actionMessage.value = '';
  savingPrivate.value = true;
  try {
    await api.patch(`/stance-applications/${application.id}`, { ...privateDraft, note: application.note || '', expectedUpdatedAt: application.updatedAt });
    actionMessage.value = '提案修改已儲存。'; actionOk.value = true;
    await loadPrivateApplications();
    editingPrivate.value = false;
    const refreshed = privateApplications.value.find((item) => item.id === application.id);
    if (refreshed) Object.assign(privateDraft, { title: refreshed.title, rationale: refreshed.rationale || '' });
  } catch (cause) { actionMessage.value = errorMessage(cause); actionOk.value = false; }
  finally { savingPrivate.value = false; }
}

async function withdrawPrivateApplication(application: StanceApplication) {
  if (!window.confirm('確定要取消這筆立場提案嗎？取消後將不再送交議題小組。')) return;
  withdrawing.value = true; actionMessage.value = '';
  const parentStanceId = application.parentStanceId;
  try {
    await api.delete(`/stance-applications/${application.id}`);
    await loadPrivateApplications();
    selectedApplicationId.value = null;
    if (parentStanceId) selectNode(parentStanceId); else clearSelection();
    actionMessage.value = '立場提案已取消。'; actionOk.value = true;
  } catch (cause) { actionMessage.value = errorMessage(cause); actionOk.value = false; }
  finally { withdrawing.value = false; }
}

function selectNode(id: string) {
  selectedApplicationId.value = null;
  selectedId.value = id;
  detailTab.value = 'DETAIL';
  emit('select', id);
}

function selectDetailTab(tab: DetailTab) {
  detailTab.value = tab;
  emit('tab', tab);
}

function clearSelection() {
  selectedApplicationId.value = null;
  selectedId.value = null;
  detailTab.value = 'DETAIL';
  emit('select', null);
}

function returnPrevious() {
  if (selectedApplication.value) {
    if (selectedApplication.value.parentStanceId) selectNode(selectedApplication.value.parentStanceId);
    else clearSelection();
    return;
  }
  if (parentNode.value) selectNode(parentNode.value.id);
  else clearSelection();
}

function pathLabel(node: StanceNode) {
  return pathNodes(node).map((item) => item.title).join(' / ');
}

function pathNodes(node: StanceNode) {
  const path: StanceNode[] = [node];
  let parentId = node.parentId;
  while (parentId) { const parent = nodeMap.value.get(parentId); if (!parent) break; path.unshift(parent); parentId = parent.parentId; }
  return path;
}

function countDescendants(node: StanceNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

function applyProposalDraft(form: TopicAuthoringForm | StanceAuthoringForm) {
  if (!('rationale' in form)) return;
  proposalTitle.value = form.title;
  proposalRationale.value = form.rationale;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function toggleSignal(signal: StanceSignal) {
  if (!selectedNode.value) return;
  toggling.value = signal;
  actionMessage.value = '';
  try {
    await api.post(`/topics/${props.topicId}/stances/${selectedNode.value.id}/signal`, { signal });
    await load();
  } catch (cause) {
    actionMessage.value = errorMessage(cause);
    actionOk.value = false;
  } finally {
    toggling.value = null;
  }
}

function openProposal(parent: StanceNode | null) {
  proposalParent.value = parent;
  proposalTitle.value = '';
  proposalRationale.value = '';
  proposalError.value = '';
  proposalOpen.value = true;
}

function closeProposal() { proposalOpen.value = false; }

function applicationStatusLabel(application: StanceApplication) {
  if (application.status === 'PENDING') return '已送出 · 可修改';
  if (application.status === 'IN_REVIEW') return '小組審閱中 · 暫停修改';
  if (application.status === 'REJECTED') return application.target.canResubmit ? '請修改後重送' : '未採用';
  return application.status;
}

async function addStance() {
  const title = proposalTitle.value.trim();
  const rationale = proposalRationale.value.trim();
  adding.value = true;
  proposalError.value = '';
  try {
    const created = await api.post<StanceApplication>('/stance-applications', {
      topicId: props.topicId,
      parentStanceId: proposalParent.value?.id,
      title,
      rationale: rationale || undefined,
    });
    await loadPrivateApplications();
    closeProposal();
    const application = privateApplications.value.find((item) => item.id === created.id) ?? created;
    selectApplication(application);
    actionMessage.value = '立場提案已送出，目前只有你看得到。'; actionOk.value = true;
  } catch (cause) {
    proposalError.value = errorMessage(cause);
  } finally {
    adding.value = false;
  }
}

async function submitReport() {
  if (!selectedNode.value) return;
  reporting.value = true;
  try {
    await api.post(`/topics/${props.topicId}/stances/${selectedNode.value.id}/report`, { reason: reportReason.value, detail: reportDetail.value.trim() || undefined });
    reportDetail.value = ''; showReport.value = false;
    actionMessage.value = '已送出檢舉，感謝回報。'; actionOk.value = true;
  } catch (cause) {
    actionMessage.value = errorMessage(cause); actionOk.value = false;
  } finally {
    reporting.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) { if (event.key === 'Escape' && proposalOpen.value) closeProposal(); }

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);
  if (props.authed && !auth.capabilitySummary) {
    try { auth.setCapabilities(await api.get('/me/capabilities')); } catch { /* Public stance browsing remains available. */ }
  }
  await Promise.all([load(), loadPrivateApplications()]);
});
onBeforeUnmount(() => { if (import.meta.client) { document.body.style.overflow = ''; window.removeEventListener('keydown', handleKeydown); } });
</script>
