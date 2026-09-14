<template>
  <article class="mx-auto max-w-3xl pb-12">
    <header class="border-b-2 border-[#171717] pb-6">
      <p class="eyebrow text-[#3157d5]">版本 2026-09-v3</p>
      <h1 class="mt-2 text-3xl font-black tracking-[-0.04em]">資料使用與投票分析告知</h1>
      <p class="mt-3 text-sm leading-6 text-[#6d6861]">本頁說明選填分析資料與 AI 表達助手如何處理資料。人口資料完全自願，不填寫或不同意分析都不影響投票資格。</p>
    </header>

    <div class="mt-8 space-y-8 text-sm leading-7 text-[#4f4b45]">
      <section><h2 class="text-lg font-black text-[#171717]">蒐集目的</h2><p class="mt-2">用於觀察不同人口、居住、工作、收入、生活狀態與自陳人格類型對公共議題的匿名群組分布。達匿名門檻的彙總結果僅提供管理員、合作廠商與議題小組查看。16 型人格不是平台心理測驗或心理診斷；星座與十二生肖只作趣味觀察。</p></section>
      <section><h2 class="text-lg font-black text-[#171717]">蒐集項目</h2><p class="mt-2">選填項目包括生日、性別、縣市與行政區、就業狀態、產業、個人稅前年收入級距、學歷、感情／婚姻、同住型態、育兒階段、住宅狀態及 16 型人格。完整生日採欄位級加密，不會加入投票分析；宗教、族群、健康／身心狀態與政治傾向不在本版選填輪廓內。</p></section>
      <section><h2 class="text-lg font-black text-[#171717]">投票當下快照</h2><p class="mt-2">同意分析後，每次投票只保存當下各欄位的分類值。日後修改會員資料不會回寫或改變已完成投票的快照；選擇「不願透露」的新增欄位不會形成分析群組。</p></section>
      <section><h2 class="text-lg font-black text-[#171717]">匿名門檻</h2><p class="mt-2">只提供單一維度彙總，不提供交叉篩選。一般維度有效樣本至少 30 人、單一群組至少 10 人；行政區有效樣本至少 100 人、單一行政區至少 20 人。系統採互補隱藏避免以總數反推小群組，付費、管理員或企業權限也不能略過門檻。</p></section>
      <section><h2 class="text-lg font-black text-[#171717]">新版同意</h2><p class="mt-2">2026-09-v2 快照只繼續用於當時已告知的既有人口維度。行政區、收入、生活狀態與人格等新增維度，只使用會員接受本版後建立且標記為 2026-09-v3 的投票快照。</p></section>
      <section><h2 class="text-lg font-black text-[#171717]">修改與撤回</h2><p class="mt-2">會員可在「資料與隱私」修改選填資料。修改只影響未來投票；撤回同意或刪除資料時，既有分群快照會刪除，原始投票仍保留於總票數。</p></section>
      <section><h2 class="text-lg font-black text-[#171717]">未成年人</h2><p class="mt-2">未滿 18 歲會員仍可投票。匿名分群分析須由法定代理人使用不同門號完成 OTP 驗證後才會啟用；驗證前不建立投票分群資料。</p></section>
      <section><h2 class="text-lg font-black text-[#171717]">AI 表達助手</h2><p class="mt-2">使用 AI 表達助手時，你輸入的構想、澄清回答與當前表單內容會傳送至平台設定的第三方 AI 服務進行處理。訪談狀態只會短暫保存在 Redis，通常於 15 分鐘內失效，不會寫入主要資料庫；第三方服務仍可能依其政策處理資料，請勿輸入個人資料、機密或未公開資訊。AI 只提供可編輯草稿，不會替你發佈內容。</p></section>
      <section class="border-l-4 border-[#b86b12] bg-[#fff0d7] p-5"><h2 class="font-black text-[#171717]">正式上線前</h2><p class="mt-1">監護同意、保存期限、刪除請求及營運者聯絡資訊仍須由台灣個資法專業人士審閱並補齊。本文件目前為產品測試版本。</p></section>
    </div>
  </article>
</template>

<script setup lang="ts">
useSeoMeta({ title: '人口資料與投票分析告知｜輿論測風向' });
</script>
