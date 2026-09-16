<template>
  <div>
    <div class="mb-8 border-b-2 border-[#171717] pb-6">
      <h2 class="text-3xl font-black tracking-[-0.04em]">資料與隱私</h2>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-[#6d6861]">管理基本資料與匿名分析設定。</p>
    </div>

    <div v-if="loading" class="h-80 animate-pulse bg-[#e5e0d6]" />
    <form v-else class="space-y-6" @submit.prevent="save">
      <section class="border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:p-7">
        <p class="eyebrow text-[#77716a]">01 / 基本資料</p>
        <div class="mt-5 grid gap-5 border-b border-[#d7d1c6] pb-6 sm:grid-cols-[auto_1fr] sm:items-start">
          <UserAvatar :nickname="nickname" :avatar-url="auth.avatarUrl" size="lg" />
          <div>
            <p class="text-sm font-bold">頭像</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button v-for="preset in avatarPresets" :key="preset" type="button" class="focus-ring border-2 p-0.5" :class="selectedPreset === preset ? 'border-[#d84a36]' : 'border-transparent'" :aria-label="`選擇預設頭像 ${preset}`" :disabled="avatarSaving" @click="selectAvatar(preset)">
                <img :src="presetUrl(preset)" alt="" class="h-11 w-11" />
              </button>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <label class="focus-ring cursor-pointer border border-[#171717] bg-white px-4 py-2 text-xs font-bold">上傳圖片<input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" :disabled="avatarSaving" @change="uploadAvatar" /></label>
              <button v-if="auth.avatarUrl" type="button" class="focus-ring text-xs font-bold text-[#8f3022]" :disabled="avatarSaving" @click="removeAvatar">移除頭像</button>
              <span class="text-xs text-[#77716a]">PNG、JPEG 或 WebP，最大 5 MB</span>
            </div>
            <p v-if="avatarSaving" class="mt-2 text-xs text-[#3157d5]">頭像處理中…</p>
          </div>
        </div>
        <div class="mt-5 grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label class="block"><span class="mb-2 block text-sm font-bold">顯示名稱</span><input v-model.trim="nickname" minlength="2" maxlength="30" class="focus-ring w-full border border-[#bfb8ad] bg-white px-4 py-3 text-sm" /></label>
          <label class="block"><span class="mb-2 block text-sm font-bold">驗證門號</span><input :value="dashboard?.member.maskedPhone || '載入中…'" readonly class="w-full border border-[#d7d1c6] bg-[#ebe6dc] px-4 py-3 text-sm text-[#6d6861]" /></label>
          <button type="button" class="focus-ring bg-[#171717] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="accountSaving || nickname.length < 2" @click="saveAccount">{{ accountSaving ? '儲存中…' : '更新名稱' }}</button>
        </div>
      </section>

      <section class="grid gap-6 border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:grid-cols-2 sm:p-7">
        <div class="sm:col-span-2"><p class="eyebrow text-[#77716a]">02 / 人口與居住</p><p class="mt-2 text-xs leading-5 text-[#77716a]">所有欄位皆為選填，不影響投票資格。只有你能查看完整生日。</p></div>
        <label class="block">
          <span class="mb-2 block text-sm font-bold">生日</span>
          <input v-model="birthDate" type="date" :max="today" class="focus-ring w-full border border-[#bfb8ad] bg-white px-4 py-3 text-sm" />
          <span class="mt-2 block text-xs leading-5 text-[#77716a]">使用 AES-256-GCM 加密保存，用於推導年齡區間、星座與農曆生肖。</span>
        </label>
        <label class="block">
          <span class="mb-2 block text-sm font-bold">性別</span>
          <select v-model="gender" class="focus-ring w-full border border-[#bfb8ad] bg-white px-4 py-3 text-sm">
            <option value="">未填寫</option>
            <option v-for="item in genderOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-2 block text-sm font-bold">主要居住縣市</span>
          <select v-model="region" class="focus-ring w-full border border-[#bfb8ad] bg-white px-4 py-3 text-sm" @change="onRegionChange">
            <option value="">未填寫</option>
            <option v-for="item in regions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-2 block text-sm font-bold">鄉鎮市區</span>
          <select v-model="district" :disabled="!districtOptions.length" class="focus-ring w-full border border-[#bfb8ad] bg-white px-4 py-3 text-sm disabled:bg-[#ebe6dc]">
            <option value="">未填寫</option>
            <option v-for="item in districtOptions" :key="item" :value="item">{{ item }}</option>
          </select>
          <span class="mt-2 block text-xs text-[#77716a]">只蒐集行政區，不蒐集地址。</span>
        </label>
      </section>

      <section class="grid gap-6 border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:grid-cols-2 sm:p-7">
        <div class="sm:col-span-2"><p class="eyebrow text-[#77716a]">03 / 工作與收入</p><p class="mt-2 text-xs leading-5 text-[#77716a]">收入指個人稅前年收入，使用級距而非精確金額。</p></div>
        <ProfileSelect v-model="employmentStatus" label="就業狀態" :options="employmentOptions" />
        <ProfileSelect v-model="industry" label="產業類別" :options="industryOptions" />
        <ProfileSelect v-model="annualIncome" label="個人稅前年收入" :options="incomeOptions" />
        <ProfileSelect v-model="education" label="最高學歷" :options="educationOptions" />
      </section>

      <section class="grid gap-6 border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:grid-cols-2 sm:p-7">
        <div class="sm:col-span-2"><p class="eyebrow text-[#77716a]">04 / 生活狀態</p><p class="mt-2 text-xs leading-5 text-[#77716a]">育兒階段以最年幼子女目前所處階段分類。</p></div>
        <ProfileSelect v-model="relationship" label="感情／婚姻狀態" :options="relationshipOptions" />
        <ProfileSelect v-model="livingArrangement" label="同住型態" :options="livingOptions" />
        <ProfileSelect v-model="parentingStage" label="育兒階段" :options="parentingOptions" />
        <ProfileSelect v-model="housingStatus" label="住宅狀態" :options="housingOptions" />
      </section>

      <section class="border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:p-7">
        <p class="eyebrow text-[#77716a]">05 / 人格特質</p>
        <div class="mt-5 max-w-md"><ProfileSelect v-model="personalityType" label="16 型人格（自陳）" :options="personalityOptions" /></div>
      </section>

      <section v-if="profile?.westernZodiac" class="grid gap-3 sm:grid-cols-2">
        <div class="border-l-4 border-[#7a4db3] bg-[#f0e7fa] p-4"><span class="text-xs text-[#77716a]">星座</span><strong class="mt-1 block">{{ zodiacLabels[profile.westernZodiac] }}</strong></div>
        <div class="border-l-4 border-[#b86b12] bg-[#fff0d7] p-4"><span class="text-xs text-[#77716a]">十二生肖</span><strong class="mt-1 block">{{ chineseZodiacLabels[profile.chineseZodiac || ''] }}</strong></div>
      </section>

      <label class="flex cursor-pointer items-start gap-3 border-2 border-[#171717] bg-white p-5 text-sm leading-6">
        <input v-model="analyticsConsent" type="checkbox" class="mt-1 h-4 w-4 accent-[#3157d5]" />
        <span><strong class="block">06 / 同意加入匿名投票分群分析</strong>投票時建立當下的選填輪廓快照，不包含完整生日、門號或會員 ID，日後修改資料不會回寫歷史投票。達匿名門檻的單一維度彙總可能提供會員與企業分析使用；可隨時撤回並刪除既有快照。<NuxtLink to="/privacy" target="_blank" class="ml-1 font-bold text-[#3157d5] underline">閱讀資料使用告知</NuxtLink></span>
      </label>
      <p v-if="profile?.analyticsConsent && profile.consentVersion !== ANALYTICS_CONSENT_VERSION" class="border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm font-bold text-[#a63222]">人口資料用途已更新。請閱讀新版告知並再次儲存，未來投票才會加入新版匿名分析。</p>

      <section v-if="profile?.isMinor && analyticsConsent" class="border border-[#d7d1c6] bg-[#fff0d7] p-5 sm:p-7">
        <h2 class="text-lg font-black">監護人同意</h2>
        <p v-if="profile.guardianConsentStatus === 'VERIFIED'" class="mt-3 text-sm text-[#3f7a58]">監護人門號末四碼 {{ profile.guardianPhoneLast4 }} 已完成驗證，人口分析已啟用。</p>
        <div v-else class="mt-4 space-y-4">
          <p class="text-sm leading-6 text-[#6d6861]">未滿 18 歲會員須由法定代理人使用另一支手機完成驗證，驗證前不會建立投票分群資料。</p>
          <div class="flex gap-3">
            <input v-model="guardianPhone" inputmode="numeric" maxlength="10" placeholder="監護人手機 09xxxxxxxx" class="focus-ring min-w-0 flex-1 border border-[#bfb8ad] bg-white px-4 py-3 text-sm" />
            <button type="button" class="focus-ring bg-[#171717] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="sendingGuardian" @click="sendGuardianOtp">取得驗證碼</button>
          </div>
          <div v-if="guardianSent" class="space-y-3">
            <input v-model.trim="guardianCode" maxlength="6" placeholder="6 位驗證碼" class="focus-ring w-full border border-[#bfb8ad] bg-white px-4 py-3 text-sm uppercase" />
            <label class="flex items-start gap-2 text-xs leading-5"><input v-model="guardianAttested" type="checkbox" class="mt-1" /><span>我確認為此會員之法定代理人，已閱讀人口資料用途並同意加入匿名分析。</span></label>
            <button type="button" class="focus-ring bg-[#9a5b12] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="!guardianAttested || verifyingGuardian" @click="verifyGuardianOtp">完成監護驗證</button>
          </div>
        </div>
      </section>

      <p v-if="message" class="border-l-4 p-4 text-sm" :class="messageError ? 'border-[#d84a36] bg-[#fbe9e5] text-[#a63222]' : 'border-[#3f7a58] bg-[#e5f1e9] text-[#315f44]'">{{ message }}</p>
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button type="button" class="focus-ring border border-[#d84a36] px-5 py-3 text-sm font-bold text-[#a63222]" @click="removeProfile">刪除分析資料</button>
        <button type="submit" class="focus-ring bg-[#3157d5] px-7 py-3 text-sm font-black text-white disabled:opacity-50" :disabled="saving">{{ saving ? '儲存中…' : '儲存分析資料' }}</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { DemographicProfile, DemographicProfileOptions, Gender } from '~/types/profile';
import type { MemberDashboard } from '~/types/member';
import type { SessionUser } from '~/stores/auth';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '資料與隱私｜會員中心' });

const api = useApi();
const auth = useAuthStore();
const ANALYTICS_CONSENT_VERSION = '2026-09-v3';
const dashboard = useState<MemberDashboard | null>('member-dashboard', () => null);
const profile = ref<DemographicProfile | null>(null);
const nickname = ref(auth.nickname || '');
const accountSaving = ref(false);
const birthDate = ref('');
const gender = ref<Gender | ''>('');
const region = ref('');
const district = ref('');
const personalityType = ref('');
const employmentStatus = ref('');
const industry = ref('');
const annualIncome = ref('');
const education = ref('');
const relationship = ref('');
const livingArrangement = ref('');
const parentingStage = ref('');
const housingStatus = ref('');
const profileOptions = ref<DemographicProfileOptions | null>(null);
const analyticsConsent = ref(false);
const loading = ref(true);
const saving = ref(false);
const message = ref('');
const messageError = ref(false);
const guardianPhone = ref('');
const guardianCode = ref('');
const guardianSent = ref(false);
const guardianAttested = ref(false);
const sendingGuardian = ref(false);
const verifyingGuardian = ref(false);
const today = new Date().toISOString().slice(0, 10);
const config = useRuntimeConfig();
const avatarPresets = ['sun', 'wave', 'leaf', 'orbit', 'spark', 'chat'] as const;
type AvatarPreset = typeof avatarPresets[number];
const avatarSaving = ref(false);
const selectedPreset = computed(() => {
  const match = auth.avatarUrl?.match(/\/avatars\/presets\/([^/?]+)/);
  return match?.[1] || '';
});

const genderOptions = [
  { value: 'FEMALE', label: '女性' }, { value: 'MALE', label: '男性' },
  { value: 'NON_BINARY', label: '非二元' }, { value: 'OTHER', label: '其他' },
  { value: 'PREFER_NOT_TO_SAY', label: '不願透露' },
] as const;
const regions = computed(() => [...(profileOptions.value?.regions.map((item) => item.region) ?? []), ...(profileOptions.value?.specialRegions ?? [])]);
const districtOptions = computed(() => profileOptions.value?.regions.find((item) => item.region === region.value)?.districts ?? []);
const personalityOptions = optionPairs(['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'].map((value) => [value, value]), true);
const employmentOptions = optionPairs([['FULL_TIME', '全職受僱'], ['PART_TIME', '兼職受僱'], ['SELF_EMPLOYED', '自營／自由工作'], ['EMPLOYER', '雇主'], ['STUDENT', '學生'], ['HOMEMAKER_CAREGIVER', '家務／照顧者'], ['UNEMPLOYED', '待業'], ['RETIRED', '退休'], ['OTHER', '其他']], true);
const industryOptions = optionPairs([['PUBLIC_ADMINISTRATION', '公共行政'], ['EDUCATION', '教育'], ['HEALTHCARE', '醫療照護'], ['TECHNOLOGY', '科技'], ['FINANCE', '金融保險'], ['MANUFACTURING', '製造'], ['RETAIL_ECOMMERCE', '零售／電商'], ['HOSPITALITY_TOURISM', '餐旅／觀光'], ['CONSTRUCTION_REAL_ESTATE', '營建／不動產'], ['TRANSPORT_LOGISTICS', '運輸／物流'], ['PROFESSIONAL_SERVICES', '專業服務'], ['CULTURE_MEDIA', '文化／媒體'], ['AGRICULTURE', '農林漁牧'], ['NONPROFIT', '非營利組織'], ['NOT_APPLICABLE', '不適用'], ['OTHER', '其他']], true);
const incomeOptions = optionPairs([['UNDER_300K', '未滿 30 萬'], ['TWD_300K_499K', '30 萬以上，未滿 50 萬'], ['TWD_500K_799K', '50 萬以上，未滿 80 萬'], ['TWD_800K_1199K', '80 萬以上，未滿 120 萬'], ['TWD_1200K_1999K', '120 萬以上，未滿 200 萬'], ['TWD_2000K_PLUS', '200 萬以上'], ['NO_FIXED_INCOME', '無固定收入']], true);
const educationOptions = optionPairs([['MIDDLE_SCHOOL_OR_BELOW', '國中以下'], ['HIGH_SCHOOL_VOCATIONAL', '高中職'], ['ASSOCIATE', '專科'], ['BACHELOR', '大學'], ['MASTER', '碩士'], ['DOCTORATE', '博士'], ['OTHER', '其他']], true);
const relationshipOptions = optionPairs([['SINGLE', '單身'], ['DATING', '交往／伴侶關係'], ['MARRIED', '已婚'], ['SEPARATED_DIVORCED', '分居／離婚'], ['WIDOWED', '喪偶'], ['OTHER', '其他']], true);
const livingOptions = optionPairs([['ALONE', '獨居'], ['WITH_PARTNER', '與伴侶同住'], ['WITH_PARENTS_RELATIVES', '與父母／親屬同住'], ['WITH_PARTNER_CHILDREN', '與伴侶及子女同住'], ['SINGLE_PARENT_CHILDREN', '單親與子女同住'], ['THREE_GENERATION', '三代同住'], ['ROOMMATES_DORM', '室友／宿舍'], ['OTHER', '其他']], true);
const parentingOptions = optionPairs([['NO_CHILDREN', '無子女'], ['EXPECTING', '準備迎接子女'], ['PRESCHOOL', '學齡前'], ['PRIMARY_SCHOOL', '國小階段'], ['SECONDARY_SCHOOL', '中學階段'], ['ADULT_CHILDREN', '成年子女'], ['OTHER', '其他']], true);
const housingOptions = optionPairs([['OWN_OUTRIGHT', '自有且無房貸'], ['MORTGAGE', '自有且繳房貸'], ['RENT', '租屋'], ['SOCIAL_HOUSING', '社會住宅'], ['DORMITORY', '宿舍'], ['LIVING_WITH_FAMILY', '居住家人住宅'], ['OTHER', '其他']], true);
const zodiacLabels: Record<string, string> = { ARIES: '牡羊座', TAURUS: '金牛座', GEMINI: '雙子座', CANCER: '巨蟹座', LEO: '獅子座', VIRGO: '處女座', LIBRA: '天秤座', SCORPIO: '天蠍座', SAGITTARIUS: '射手座', CAPRICORN: '摩羯座', AQUARIUS: '水瓶座', PISCES: '雙魚座' };
const chineseZodiacLabels: Record<string, string> = { RAT: '鼠', OX: '牛', TIGER: '虎', RABBIT: '兔', DRAGON: '龍', SNAKE: '蛇', HORSE: '馬', GOAT: '羊', MONKEY: '猴', ROOSTER: '雞', DOG: '狗', PIG: '豬' };

function presetUrl(preset: AvatarPreset) {
  const raw = String(config.public.apiBase);
  const base = import.meta.client && raw.includes('localhost')
    ? raw.replace('//localhost:', `//${window.location.hostname}:`)
    : raw;
  return `${base.replace(/\/$/, '')}/avatars/presets/${preset}`;
}

function optionPairs(items: string[][], includePrivate = false) {
  return [...items.map(([value, label]) => ({ value, label })), ...(includePrivate ? [{ value: 'PREFER_NOT_TO_SAY', label: '不願透露' }] : [])];
}

function onRegionChange() {
  if (!districtOptions.value.includes(district.value)) district.value = '';
}

function applySession(user: SessionUser) {
  auth.setUser(user);
  if (dashboard.value) dashboard.value.member.avatarUrl = user.avatarUrl;
}

async function selectAvatar(preset: AvatarPreset) {
  avatarSaving.value = true;
  message.value = '';
  try {
    applySession(await api.put<SessionUser>('/me/avatar', { preset }));
    messageError.value = false;
    message.value = '頭像已更新。';
  } catch (error) {
    messageError.value = true;
    message.value = errorMessage(error);
  } finally {
    avatarSaving.value = false;
  }
}

async function uploadAvatar(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    messageError.value = true;
    message.value = '頭像圖片不可超過 5 MB。';
    input.value = '';
    return;
  }
  avatarSaving.value = true;
  message.value = '';
  const form = new FormData();
  form.append('file', file);
  try {
    applySession(await api.post<SessionUser>('/me/avatar', form, { timeout: 60000 }));
    messageError.value = false;
    message.value = '頭像已更新。';
  } catch (error) {
    messageError.value = true;
    message.value = errorMessage(error);
  } finally {
    avatarSaving.value = false;
    input.value = '';
  }
}

async function removeAvatar() {
  avatarSaving.value = true;
  message.value = '';
  try {
    applySession(await api.delete<SessionUser>('/me/avatar'));
    messageError.value = false;
    message.value = '頭像已移除。';
  } catch (error) {
    messageError.value = true;
    message.value = errorMessage(error);
  } finally {
    avatarSaving.value = false;
  }
}

function applyProfile(value: DemographicProfile | null) {
  profile.value = value;
  birthDate.value = value?.birthDate || '';
  gender.value = value?.gender || '';
  region.value = value?.region || '';
  district.value = value?.district || '';
  personalityType.value = value?.personalityType || '';
  employmentStatus.value = value?.employmentStatus || '';
  industry.value = value?.industry || '';
  annualIncome.value = value?.annualIncome || '';
  education.value = value?.education || '';
  relationship.value = value?.relationship || '';
  livingArrangement.value = value?.livingArrangement || '';
  parentingStage.value = value?.parentingStage || '';
  housingStatus.value = value?.housingStatus || '';
  analyticsConsent.value = value?.analyticsConsent || false;
  if (dashboard.value) {
    const completed = value ? [value.birthDate, value.gender, value.region, value.district, value.personalityType, value.employmentStatus, value.industry, value.annualIncome, value.education, value.relationship, value.livingArrangement, value.parentingStage, value.housingStatus].filter(Boolean).length : 0;
    dashboard.value.profile.completionPercent = Math.round(completed / 13 * 100);
    dashboard.value.profile.status = !value
      ? 'NOT_STARTED'
      : value.analyticsConsent && value.isMinor && value.guardianConsentStatus !== 'VERIFIED'
        ? 'PENDING_GUARDIAN'
        : value.analyticsConsent
          ? 'ACTIVE'
          : 'INACTIVE';
  }
}

async function load() {
  const [options, value] = await Promise.all([
    api.get<DemographicProfileOptions>('/me/demographic-profile/options'),
    api.get<DemographicProfile | null>('/me/demographic-profile'),
  ]);
  profileOptions.value = options;
  applyProfile(value);
}

async function save() {
  saving.value = true;
  message.value = '';
  try {
    applyProfile(await api.put<DemographicProfile>('/me/demographic-profile', {
      birthDate: birthDate.value || null,
      gender: gender.value || null,
      occupation: null,
      region: region.value || null,
      district: district.value || null,
      personalityType: personalityType.value || null,
      employmentStatus: employmentStatus.value || null,
      industry: industry.value || null,
      annualIncome: annualIncome.value || null,
      education: education.value || null,
      relationship: relationship.value || null,
      livingArrangement: livingArrangement.value || null,
      parentingStage: parentingStage.value || null,
      housingStatus: housingStatus.value || null,
      analyticsConsent: analyticsConsent.value,
      analyticsConsentVersion: analyticsConsent.value ? ANALYTICS_CONSENT_VERSION : undefined,
    }));
    messageError.value = false;
    message.value = profile.value?.analysisActive ? '分析資料已儲存，之後的投票將加入匿名分群。' : profile.value?.isMinor && analyticsConsent.value ? '資料已儲存，完成監護人驗證後才會加入分析。' : '分析資料已儲存。';
  } catch (error) {
    messageError.value = true;
    message.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
}

async function saveAccount() {
  accountSaving.value = true;
  message.value = '';
  try {
    const user = await api.put<SessionUser>('/me/account', { nickname: nickname.value });
    auth.setUser(user);
    if (dashboard.value) dashboard.value.member.nickname = user.nickname;
    messageError.value = false;
    message.value = '顯示名稱已更新。';
  } catch (error) {
    messageError.value = true;
    message.value = errorMessage(error);
  } finally {
    accountSaving.value = false;
  }
}

async function sendGuardianOtp() {
  sendingGuardian.value = true;
  message.value = '';
  try {
    await api.post('/me/demographic-profile/guardian/send', { phoneNumber: guardianPhone.value });
    guardianSent.value = true;
    messageError.value = false;
    message.value = '監護驗證碼已發送，有效時間 5 分鐘。';
  } catch (error) {
    messageError.value = true;
    message.value = errorMessage(error);
  } finally {
    sendingGuardian.value = false;
  }
}

async function verifyGuardianOtp() {
  verifyingGuardian.value = true;
  try {
    applyProfile(await api.post<DemographicProfile>('/me/demographic-profile/guardian/verify', {
      phoneNumber: guardianPhone.value,
      code: guardianCode.value,
      attestsLegalGuardian: guardianAttested.value,
    }));
    messageError.value = false;
    message.value = '監護人驗證完成，匿名人口分析已啟用。';
  } catch (error) {
    messageError.value = true;
    message.value = errorMessage(error);
  } finally {
    verifyingGuardian.value = false;
  }
}

async function removeProfile() {
  if (!confirm('確定刪除分析資料與所有投票分群資料？原始投票仍會保留。')) return;
  await api.delete('/me/demographic-profile');
  applyProfile(null);
  messageError.value = false;
  message.value = '分析資料與匿名分群資料已刪除。';
}

onMounted(async () => {
  try { await load(); } catch (error) { messageError.value = true; message.value = errorMessage(error); } finally { loading.value = false; }
});
</script>
