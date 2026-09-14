<template>
  <section class="border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:p-6">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-xl font-black">討論（{{ totalPosts }}）</h2>
        <p class="mt-1 text-xs text-[#6d6861]">正在討論：<strong>{{ stanceTitle || '指定立場' }}</strong></p>
      </div>
      <button type="button" class="focus-ring min-h-10 text-xs font-black text-[#3157d5]" @click="emit('clearStance')">回到全部立場</button>
    </div>

    <form v-if="authed && open && canInteract" class="mb-6" @submit.prevent="submitPost">
      <textarea
        v-model="newPost"
        rows="3"
        maxlength="2000"
        placeholder="分享你的看法，也可以只貼 GIF…"
        class="focus-ring w-full border border-[#bfb8ad] bg-white p-3 text-sm"
      />
      <GifAttachmentGrid class="mt-3" :attachments="postAttachments" removable @remove="removePostAttachment" />
      <div class="mt-3 flex flex-wrap items-start justify-between gap-3">
        <GifAssetPicker v-model="postMemeIds" :max="4" @change="postAttachments = $event" />
        <button class="focus-ring bg-[#171717] px-5 py-2 text-sm font-bold text-white disabled:opacity-50" :disabled="posting || (!newPost.trim() && !postMemeIds.length)">
          {{ posting ? '發佈中…' : '發佈' }}
        </button>
      </div>
    </form>
    <p v-else-if="!authed" class="mb-4 text-sm text-neutral-500">
      <NuxtLink to="/login" class="text-neutral-900 underline">登入</NuxtLink> 後即可參與討論。
    </p>
    <p v-else class="mb-4 border-l-2 border-[#77716a] pl-3 text-sm text-[#6d6861]">{{ open && !canInteract ? '此身份僅供工作或資訊查閱，討論內容為唯讀。' : '此議題已停止投票，討論內容保留為唯讀。' }}</p>

    <p v-if="error" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{{ error }}</p>

    <ul class="space-y-5">
      <li v-for="post in posts" :key="post.id" class="border-b border-neutral-100 pb-5">
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-2 text-sm font-semibold"><UserAvatar :nickname="post.author" :avatar-url="post.authorAvatarUrl" size="sm" />{{ post.author }}</span>
          <span class="text-xs text-neutral-400">{{ formatTime(post.createdAt) }}</span>
        </div>
        <p v-if="post.content" class="mt-1 whitespace-pre-wrap text-sm">{{ post.content }}</p>
        <GifAttachmentGrid class="mt-3 max-w-xl" :attachments="post.attachments || []" />
        <div class="mt-2 flex items-center gap-4 text-xs text-neutral-500">
          <button v-if="authed && canInteract" @click="like('post', post.id)">讚 ({{ post.likeCount }})</button>
          <span v-else>讚 ({{ post.likeCount }})</span>
          <button @click="toggleComments(post)">留言 ({{ post.commentCount }})</button>
        </div>

        <div v-if="openPostId === post.id" class="mt-3 space-y-3">
          <form v-if="authed && open && canInteract" class="border-l-2 border-[#171717] pl-3" @submit.prevent="submitComment(post.id)">
            <input
              v-model="newComment"
              maxlength="500"
              placeholder="回覆…"
              class="focus-ring w-full border border-[#bfb8ad] bg-white px-3 py-2 text-sm"
            />
            <GifAttachmentGrid class="mt-2 max-w-xs" :attachments="commentAttachments" removable @remove="removeCommentAttachment" />
            <div class="mt-2 flex flex-wrap items-start justify-between gap-2">
              <GifAssetPicker v-model="commentMemeIds" :max="1" @change="commentAttachments = $event" />
              <button class="focus-ring bg-[#171717] px-4 py-2 text-sm text-white" :disabled="!newComment.trim() && !commentMemeIds.length">送出</button>
            </div>
          </form>
          <ul v-if="comments.length" class="space-y-2 text-sm">
            <li v-for="c in comments" :key="c.id" class="rounded-lg bg-neutral-50 p-3">
              <span class="flex items-center gap-2 font-semibold"><UserAvatar :nickname="c.author" :avatar-url="c.authorAvatarUrl" size="sm" />{{ c.author }}</span><span v-if="c.content" class="mt-2 block">{{ c.content }}</span>
              <GifAttachmentGrid class="mt-2 max-w-xs" :attachments="c.attachments || []" />
            </li>
          </ul>
          <p v-else class="text-xs text-neutral-400">尚無留言</p>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { GifAsset } from '~/types/gif';

interface Post {
  id: string;
  topicId: string;
  stanceId: string;
  author: string;
  authorAvatarUrl?: string | null;
  content: string;
  likeCount: string;
  commentCount: string;
  createdAt: string;
  attachments: GifAsset[];
}
interface Comment {
  id: string;
  postId: string;
  author: string;
  authorAvatarUrl?: string | null;
  content: string;
  createdAt: string;
  attachments: GifAsset[];
}

const props = withDefaults(defineProps<{ topicId: string; authed: boolean; open?: boolean; canInteract?: boolean; stanceId: string; stanceTitle?: string }>(), { open: true, canInteract: true, stanceTitle: '' });
const emit = defineEmits<{ clearStance: [] }>();

const api = useApi();
const posts = ref<Post[]>([]);
const comments = ref<Comment[]>([]);
const totalPosts = ref('0');
const newPost = ref('');
const newComment = ref('');
const postMemeIds = ref<string[]>([]);
const commentMemeIds = ref<string[]>([]);
const postAttachments = ref<GifAsset[]>([]);
const commentAttachments = ref<GifAsset[]>([]);
const posting = ref(false);
const error = ref('');
const openPostId = ref<string | null>(null);

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadPosts() {
  try {
    const data = await api.get<{ items: Post[]; pagination: { total: number } }>(`/topics/${props.topicId}/posts`, {
      limit: 50,
      stanceId: props.stanceId,
    });
    posts.value = data.items;
    totalPosts.value = String(data.pagination.total);
  } catch (cause) {
    error.value = errorMessage(cause);
  }
}

async function loadComments(postId: string) {
  try {
    const data = await api.get<{ items: Comment[] }>(`/posts/${postId}/comments`, { limit: 50 });
    comments.value = data.items;
  } catch (cause) {
    error.value = errorMessage(cause);
  }
}

function toggleComments(post: Post) {
  newComment.value = '';
  commentMemeIds.value = [];
  commentAttachments.value = [];
  if (openPostId.value === post.id) {
    openPostId.value = null;
    return;
  }
  openPostId.value = post.id;
  loadComments(post.id);
}

async function submitPost() {
  if (!newPost.value.trim() && !postMemeIds.value.length) return;
  posting.value = true;
  error.value = '';
  try {
    await api.post(`/topics/${props.topicId}/posts`, { content: newPost.value.trim(), memeIds: postMemeIds.value, stanceId: props.stanceId });
    newPost.value = '';
    postMemeIds.value = [];
    postAttachments.value = [];
    await loadPosts();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    posting.value = false;
  }
}

async function submitComment(postId: string) {
  if (!newComment.value.trim() && !commentMemeIds.value.length) return;
  error.value = '';
  try {
    await api.post(`/posts/${postId}/comments`, { content: newComment.value.trim(), memeIds: commentMemeIds.value });
    newComment.value = '';
    commentMemeIds.value = [];
    commentAttachments.value = [];
    await loadComments(postId);
    await loadPosts();
  } catch (e) {
    error.value = errorMessage(e);
  }
}

async function like(targetType: 'post' | 'comment', targetId: string) {
  error.value = '';
  try {
    await api.post('/likes', { targetType, targetId });
    if (targetType === 'post') await loadPosts();
    else if (openPostId.value) await loadComments(openPostId.value);
  } catch (e) {
    error.value = errorMessage(e);
  }
}

function removePostAttachment(id: string) {
  postMemeIds.value = postMemeIds.value.filter((item) => item !== id);
  postAttachments.value = postAttachments.value.filter((item) => item.id !== id);
}

function removeCommentAttachment(id: string) {
  commentMemeIds.value = commentMemeIds.value.filter((item) => item !== id);
  commentAttachments.value = commentAttachments.value.filter((item) => item.id !== id);
}

onMounted(loadPosts);
watch(() => props.stanceId, loadPosts);
</script>
