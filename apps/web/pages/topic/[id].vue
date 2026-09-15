<template>
  <div v-if="loading" class="mx-auto max-w-3xl">
    <div class="h-64 animate-pulse bg-[#e5e0d6]" />
  </div>
  <div v-else-if="pageError" class="mx-auto max-w-3xl border-l-4 border-[#d84a36] bg-[#fbe9e5] p-5">
    <p class="font-black text-[#a63222]">議題載入失敗</p>
    <p class="mt-2 text-sm">{{ pageError }}</p>
    <button type="button" class="focus-ring mt-4 bg-[#171717] px-4 py-2 text-sm font-black text-white" @click="load">重新載入</button>
  </div>
  <div v-else-if="topic" class="mx-auto max-w-6xl space-y-6">
    <div class="max-w-3xl">
      <NuxtLink to="/" class="focus-ring text-sm font-bold text-[#6d6861] hover:text-[#d84a36]">&larr; 返回</NuxtLink>
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <span v-if="topic.kind !== 'QUICK'" class="border border-[#171717] px-2 py-1 text-xs font-bold">{{ getCategoryMeta(topic.category).label }}</span>
        <span v-if="topic.kind === 'QUICK'" class="bg-[#b0761f] px-2 py-1 text-xs font-black text-white">快問</span>
        <span class="bg-[#171717] px-2 py-1 text-xs font-black text-white">議題小組發布</span>
        <span v-if="topic.proposedBy?.length" class="text-xs text-[#6d6861]">提案參與者：{{ topic.proposedBy.map((person) => person.label).join('、') }}</span>
        <span v-if="topic.moderationStatus === 'PENDING_REVIEW'" class="bg-[#fff0d7] px-2 py-1 text-xs font-bold text-[#9a5b12]">待平台複核</span>
        <span v-if="topic.hasVoted" class="bg-[#e5f1e9] px-2 py-1 text-xs font-bold text-[#3f7a58]">已投票</span>
        <span v-if="topic.status === 'LOCKED'" class="bg-[#ebe6dc] px-2 py-1 text-xs font-bold text-[#6d6861]">歷史版本</span>
      </div>
      <h1 class="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl">{{ topic.title }}</h1>
      <p v-if="topic.description" class="mt-3 text-sm leading-6 text-[#5f5a53]">{{ topic.description }}</p>
      <p class="mt-3 text-sm font-bold text-[#77716a]">{{ totalVotes }} 票 · {{ topic.voteEndAt ? `截止 ${formatTime(topic.voteEndAt)}` : '尚未開放投票' }}</p>
    </div>

    <nav v-if="sections.length > 1" class="sticky top-16 z-20 -mx-4 flex gap-1 overflow-x-auto border-y border-[#171717] bg-[#f4f1ea]/95 px-4 py-2 backdrop-blur sm:mx-0" aria-label="議題內容分區">
      <button
        v-for="item in sections"
        :key="item.value"
        type="button"
        class="focus-ring min-h-11 shrink-0 px-4 text-sm font-black"
        :class="activeSection === item.value ? 'bg-[#171717] text-white' : 'bg-[#ebe6dc] text-[#5f5a53] hover:bg-[#d7d1c6]'"
        :aria-current="activeSection === item.value ? 'page' : undefined"
        @click="setSection(item.value)"
      >
        {{ item.label }}<span v-if="item.count !== null" class="ml-1 opacity-70">{{ item.count }}</span>
      </button>
    </nav>

    <section v-show="activeSection === 'vote'" class="max-w-3xl overflow-hidden rounded-2xl border border-[#ded7cb] bg-[#faf8f3] shadow-[0_8px_28px_rgba(23,23,23,0.08)]">
      <header class="border-b border-[#ded7cb] px-5 py-4 sm:px-6">
        <p class="eyebrow-modern text-[#d84a36]">{{ showResults ? '投票結果' : '你的選擇' }}</p>
        <h2 class="mt-1 text-xl font-black">{{ showResults ? '目前風向' : '請選擇你的立場' }}</h2>
      </header>

      <div class="p-5 sm:p-6">
        <div v-if="!showResults && isVotingOpen && !auth.isAuthed" class="mb-4 rounded-xl border border-[#b7c6ee] bg-[#e7ecff] p-4 text-sm font-bold text-[#2746b4]">登入後即可投票</div>

        <div v-if="!showResults && isVotingOpen && !participationReady" class="h-24 animate-pulse rounded-xl bg-[#eee9e0]" />
        <div v-else-if="!showResults && isVotingOpen && auth.isAuthed && !auth.canVote" class="rounded-xl border border-[#e6cf9e] bg-[#fff8ec] p-4 text-sm font-bold text-[#8f5d14]">此身份僅供工作或資訊查閱，不能參與投票。</div>

        <template v-else-if="!showResults && isVotingOpen && topic.topicType === 'SPECTRUM'">
          <div class="flex items-end justify-between">
            <span class="text-sm font-bold text-[#6d6861]">目前選擇</span>
            <strong class="text-4xl font-black tabular-nums text-[#3157d5]">{{ spectrumValue }}<small class="ml-1 text-sm text-[#77716a]">/ 100</small></strong>
          </div>
          <input v-model.number="spectrumValue" type="range" min="0" max="100" class="spec-range focus-ring mt-5 w-full accent-[#3157d5]" :class="{ 'cursor-not-allowed opacity-60': isInteractionLocked }" :disabled="isInteractionLocked" />
          <div class="mt-2 flex justify-between text-xs font-bold text-[#77716a]"><span>0</span><span>50</span><span>100</span></div>
          <UiButton v-if="!isInteractionLocked" variant="data" block class="mt-6" :disabled="voting || confirmingSpectrum" @click="confirmingSpectrum = true">
            確認送出 {{ spectrumValue }} 分
          </UiButton>
        </template>

        <template v-else-if="!showResults && isVotingOpen && topic.topicType === 'SHORT_ANSWER'">
          <label for="short-answer" class="block text-sm font-bold text-[#6d6861]">你的回答（公開顯示並統計）</label>
          <textarea id="short-answer" v-model="shortAnswerText" maxlength="500" rows="4" :disabled="isInteractionLocked" placeholder="說說你的看法…" class="mt-3 block w-full resize-y rounded-xl border border-[#ded7cb] bg-white p-4 text-sm focus:border-[#3157d5] focus:outline-none" :class="{ 'cursor-not-allowed opacity-60': isInteractionLocked }" />
          <div class="mt-1 text-right text-xs tabular-nums text-[#8b857d]">{{ shortAnswerText.length }} / 500</div>
          <UiButton v-if="!isInteractionLocked" variant="data" block class="mt-4" :disabled="voting || !shortAnswerText.trim()" @click="submitShortAnswer">
            {{ voting ? '送出中…' : '送出回答' }}
          </UiButton>
        </template>

        <template v-else-if="!showResults && isVotingOpen && topic.topicType === 'MATCHING'">
          <p class="text-sm leading-6 text-[#6d6861]">先點左側項目，再點右側對應的配對。配對正確即完成投票。</p>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <button v-for="o in topic.options" :key="o.id" type="button" class="focus-ring relative flex min-h-12 w-full items-center rounded-xl border-2 bg-white px-3 py-2.5 text-left text-sm font-bold transition" :class="[matchedPair?.includes(o.id) ? 'match-success border-[#3f7a58] bg-[#e5f1e9] text-[#3f7a58]' : '', matchingLeftId === o.id ? 'matching-picked border-[#3157d5] bg-[#e7ecff] text-[#3157d5]' : 'border-[#ded7cb]']" :disabled="voting || matchingPending || isInteractionLocked" @click="onMatchingLeft(o.id)">
                <span class="min-w-0">{{ o.label }}</span>
                <span v-if="matchingLeftId === o.id" class="ml-2 text-[#3157d5]" aria-hidden="true">●</span>
              </button>
            </div>
            <div class="space-y-2">
              <button v-for="o in topic.options" :key="o.id" type="button" class="focus-ring flex min-h-12 w-full items-center rounded-xl border-2 border-dashed bg-white px-3 py-2.5 text-left text-sm font-bold transition" :class="[matchedPair?.includes(o.id) ? 'match-success border-[#3f7a58] bg-[#e5f1e9] text-[#3f7a58]' : '', matchingWrong === o.id ? 'match-wrong border-[#d84a36] bg-[#fbe9e5] text-[#a63222]' : '', matchingLeftId ? 'matching-ready border-[#3157d5] text-[#3157d5]' : 'border-[#cfc8bc] text-[#8b857d]']" :disabled="voting || matchingPending || isInteractionLocked || !matchingLeftId" @click="onMatchingRight(o.id)">{{ o.data?.match }}</button>
            </div>
          </div>
          <p v-if="matchingPending" class="mt-3 text-center text-xs font-bold text-[#3f7a58]">配對成功！送出中…</p>
        </template>

        <template v-else-if="!showResults && isVotingOpen && topic.topicType === 'PUZZLE'">
          <p class="text-sm leading-6 text-[#6d6861]">把下方打亂的字塊依正確順序點回原詞，拼完即完成投票。</p>
          <div class="mt-4 space-y-4">
            <div v-for="o in topic.options" :key="o.id">
              <p class="mb-2 flex items-center justify-between text-xs font-bold text-[#77716a]">
                <span>進度 {{ Math.min(puzzleProgress[o.id] ?? 0, o.label.length) }} / {{ o.label.length }} · {{ o.label }}</span>
                <span class="ml-2 tracking-[0.18em]"><span class="text-[#3f7a58]">{{ '•'.repeat(Math.min(puzzleProgress[o.id] ?? 0, o.label.length)) }}</span><span class="text-[#d7d1c6]">{{ '•'.repeat(Math.max(o.label.length - (puzzleProgress[o.id] ?? 0), 0)) }}</span></span>
              </p>
              <div class="relative flex flex-wrap gap-2" :class="{ 'puzzle-row-shake': puzzleWrongRow === o.id }">
                <button v-for="(letter, index) in (puzzleShuffles[o.id] ?? o.label.split(''))" :key="index" type="button" class="focus-ring grid h-11 w-11 place-items-center rounded-xl border-2 text-lg font-black transition" :class="[puzzleDoneId === o.id ? 'tile-assemble border-[#3f7a58] bg-[#e5f1e9] text-[#3f7a58]' : '', puzzleJustIndex?.optionId === o.id && puzzleJustIndex?.index === index ? 'tile-pop border-[#3f7a58] bg-[#e5f1e9] text-[#3f7a58]' : (puzzleProgress[o.id] ?? 0) > 0 ? 'border-[#3157d5] bg-[#e7ecff] text-[#3157d5]' : 'border-[#ded7cb] bg-white']" :style="puzzleDoneId === o.id ? { animationDelay: `${index * 55}ms` } : undefined" :disabled="voting || isInteractionLocked || puzzleDoneId === o.id" @click="onPuzzleTile(o.id, index, letter)">{{ letter }}</button>
                <UiConfetti v-if="puzzleDoneId === o.id" :burst-key="`puzzle-${o.id}`" :count="10" />
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="!showResults && isVotingOpen && topic.topicType === 'SCRATCH'">
          <p class="text-sm leading-6 text-[#6d6861]">按住卡片刮開偽裝貼紙，刮到底即投下那一票。</p>
          <div class="mt-4 grid grid-cols-3 gap-3" @mouseup="scratchStop" @mouseleave="scratchStop" @touchend="scratchStop">
            <button v-for="(o, index) in topic.options" :key="o.id" type="button" class="focus-ring relative aspect-square select-none overflow-hidden rounded-2xl border-2 bg-white text-xs font-black transition" :class="[voting || isInteractionLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer touch-none', (scratchProgress[o.id] ?? 0) > 0 && (scratchProgress[o.id] ?? 0) < 1 ? 'scratch-wiggle' : '', scratchDoneId === o.id ? 'scratch-win border-[#3f7a58]' : 'border-[#ded7cb]']" :disabled="voting || isInteractionLocked" @mousedown="scratchStart(o.id)" @touchstart.prevent="scratchStart(o.id)">
              <span class="grid h-full w-full place-items-center px-1 text-center leading-tight" :class="scratchDoneId === o.id ? 'text-[#3f7a58]' : ''">{{ o.label }}</span>
              <span v-if="scratchDoneId === o.id" class="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-2xl text-[#3f7a58]" aria-hidden="true">✓</span>
              <span class="scratch-pattern absolute inset-0 grid place-items-center rounded-xl bg-gradient-to-br from-[#9a6a12] to-[#c9a15e] text-xl font-black text-white" :style="{ opacity: 1 - (scratchProgress[o.id] ?? 0) }">
                <span class="scratch-shine pointer-events-none absolute inset-0" />
                <span class="grid h-full w-full place-items-center">{{ (scratchProgress[o.id] ?? 0) > 0 ? '刮' : '？' }}</span>
                <span class="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-black/20 text-[10px] font-bold">{{ index + 1 }}</span>
              </span>
              <UiConfetti v-if="scratchDoneId === o.id" :burst-key="`scratch-${o.id}`" :count="10" />
            </button>
          </div>
        </template>

        <template v-else-if="isVotingOpen && topic.topicType === 'SPIN_WHEEL' && (!showResults || showGameAgain)">
          <div class="relative mx-auto w-full max-w-72">
            <span class="wheel-pointer absolute left-1/2 top-0 z-10 -ml-[10px]" aria-hidden="true" />
            <div class="relative">
              <svg viewBox="0 0 200 200" class="block w-full drop-shadow-sm" :class="{ 'cursor-wait': wheelSpinning }" :style="wheelSpinning ? { transform: `rotate(${wheelDeg}deg)`, transition: 'transform 2.8s cubic-bezier(0.2, 0.7, 0.2, 1)' } : { transform: `rotate(${wheelDeg}deg)` }" role="img" aria-label="轉盤">
                <defs>
                  <radialGradient id="wheel-hub-grad" cx="50%" cy="42%" r="70%">
                    <stop offset="0%" stop-color="#fffdf8" />
                    <stop offset="100%" stop-color="#ebd9b8" />
                  </radialGradient>
                </defs>
                <g v-for="(o, index) in topic.options" :key="o.id">
                  <path :d="wheelArc(index)" :fill="wheelColors[index % wheelColors.length]" stroke="#fffaf0" stroke-width="1.5" :class="{ 'wheel-hit': wheelHitIndex === index }" />
                  <text :x="wheelLabel(index).x" :y="wheelLabel(index).y" :transform="`rotate(${wheelLabel(index).rotate} ${wheelLabel(index).x} ${wheelLabel(index).y})`" text-anchor="middle" font-size="12" font-weight="700" fill="#fffaf0">{{ o.label }}</text>
                </g>
                <circle cx="100" cy="100" r="21" fill="url(#wheel-hub-grad)" stroke="#ded7cb" stroke-width="2" class="wheel-hub" :class="{ 'hub-pulse': !wheelSpinning }" />
                <text x="100" y="105" text-anchor="middle" font-size="13" font-weight="900" fill="#8f5d14">GO</text>
              </svg>
              <span v-if="wheelSpinning" class="wheel-sheen pointer-events-none absolute inset-0 rounded-full" aria-hidden="true" />
              <UiConfetti v-if="wheelHitIndex !== null" :burst-key="`wheel-${wheelConfettiKey}`" :count="14" />
            </div>
            <div class="mt-4 flex flex-col items-center gap-1.5 text-center">
              <UiButton variant="data" :disabled="wheelSpinning || voting || isInteractionLocked" @click="spinWheel">{{ wheelSpinning ? '轉動中…' : '轉一次！' }}</UiButton>
              <button v-if="showGameAgain" type="button" class="focus-ring text-xs font-bold text-[#77716a] hover:underline" @click="showGameAgain = false">返回結果</button>
            </div>
          </div>
        </template>

        <template v-else-if="isVotingOpen && topic.topicType === 'LOTTERY' && (!showResults || showGameAgain)">
          <div class="rounded-2xl border border-[#e0c9a0] bg-gradient-to-b from-[#fffaf0] to-[#fdf3e0] p-5">
            <div class="relative mx-auto max-w-sm overflow-hidden rounded-xl">
              <div class="lottery-shell relative">
                <div class="lottery-lid relative flex items-center justify-between px-4 py-2">
                  <span class="lottery-lid-knob" aria-hidden="true" />
                  <span class="text-[10px] font-black tracking-[0.18em] text-[#8f5d14]">{{ lotteryState === 'result' ? '抽籤完成' : '搖獎箱' }}</span>
                  <span class="lottery-lid-knob" aria-hidden="true" />
                </div>
                <div class="relative mx-auto flex h-40 flex-wrap items-center justify-center gap-2 px-3" :class="{ 'lottery-shake': lotteryState === 'shaking' }">
                  <span v-for="(o, index) in topic.options" :key="o.id" class="lottery-ball grid size-14 place-items-center rounded-full border text-sm font-black shadow-sm" :class="lotteryResultId === o.id ? 'lottery-ball-hit' : 'border-[#e0c9a0] bg-white text-[#8f5d14]'">{{ index + 1 }}</span>
                  <span v-if="lotteryState === 'drawing'" class="lottery-light-beam pointer-events-none absolute left-1/2 top-10 z-10 -translate-x-1/2" aria-hidden="true" />
                </div>
              </div>
              <div v-if="lotteryState === 'drawing'" class="lottery-draw-wrap pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center">
                <span class="lottery-draw-ball grid size-14 place-items-center rounded-full border border-[#b0761f] bg-white text-sm font-black text-[#8f5d14] shadow-lg">{{ lotteryDrawNumber }}<span class="absolute -bottom-5 text-[9px] font-bold text-[#b0761f]">出球中</span></span>
              </div>
              <UiConfetti v-if="lotteryState === 'result'" :burst-key="`lottery-${lotteryConfettiKey}`" :count="14" />
            </div>
            <p class="mt-3 text-center text-xs font-bold text-[#8f5d14]">{{ lotteryStatusLabel }}</p>
            <div class="mt-3 flex flex-col items-center gap-1.5 text-center">
              <UiButton variant="data" :disabled="lotteryState === 'shaking' || lotteryState === 'drawing' || voting || isInteractionLocked" @click="shakeLottery">{{ voting ? '送出中…' : '搖一搖' }}</UiButton>
              <button v-if="showGameAgain" type="button" class="focus-ring text-xs font-bold text-[#77716a] hover:underline" @click="showGameAgain = false; lotteryState = 'idle'; lotteryResultId = null">返回結果</button>
            </div>
          </div>
        </template>

        <template v-else-if="!showResults && isVotingOpen">
          <div class="space-y-2.5">
            <button
              v-for="o in topic.options"
              :key="o.id"
              type="button"
              class="focus-ring flex min-h-12 w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left font-bold transition"
              :class="[selectedOptionId === o.id ? 'border-[#3157d5] bg-[#e7ecff] text-[#3157d5]' : 'border-[#ded7cb] bg-white', isInteractionLocked ? 'cursor-not-allowed opacity-60 hover:border-[#ded7cb]' : 'hover:border-[#171717]']"
              :disabled="voting || isInteractionLocked"
              @click="onOptionTap(o.id)"
            >
              <span>{{ o.label }}</span>
              <span class="flex items-center gap-2">
                <span v-if="voting && votingTargetId === o.id" class="size-4 animate-spin rounded-full border-2 border-[#3157d5] border-t-transparent" aria-hidden="true" />
                <span v-else aria-hidden="true">{{ selectedOptionId === o.id ? '✓' : '○' }}</span>
              </span>
            </button>
          </div>

          <div v-if="confirmingOptionId" class="mt-4 flex flex-col gap-3 rounded-xl border-2 border-[#3157d5] bg-[#e7ecff] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm font-bold text-[#2746b4]">確定送出「{{ selectedOption?.label }}」？送出後無法修改。</p>
            <div class="flex shrink-0 gap-2">
              <UiButton variant="outline" size="sm" :disabled="voting" @click="resetVoteIntents">重選</UiButton>
              <UiButton variant="data" size="sm" :disabled="voting" @click="submitVote">{{ voting ? '送出中…' : '確定送出' }}</UiButton>
            </div>
          </div>
          <div v-if="confirmingSpectrum" class="mt-4 flex flex-col gap-3 rounded-xl border-2 border-[#3157d5] bg-[#e7ecff] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm font-bold text-[#2746b4]">確定送出 {{ spectrumValue }} 分？送出後無法修改。</p>
            <div class="flex shrink-0 gap-2">
              <UiButton variant="outline" size="sm" :disabled="voting" @click="confirmingSpectrum = false">重選</UiButton>
              <UiButton variant="data" size="sm" :disabled="voting" @click="submitVote">{{ voting ? '送出中…' : '確定送出' }}</UiButton>
            </div>
          </div>
        </template>

        <template v-else-if="isQuick && isVotingOpen && showResults && topic.topicType === 'SPECTRUM'">
          <p class="mb-4 flex items-center gap-2 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">
            <span aria-hidden="true">✓</span> 已投票 — 快問結果即時更新，可調整滑桿更改票。
          </p>
          <div class="flex items-end justify-between">
            <span class="text-sm font-bold text-[#6d6861]">社群中位數</span>
            <strong class="text-4xl font-black tabular-nums text-[#b0761f]">{{ Math.round(Number(topic.spectrumMedian || 0)) }}<small class="ml-1 text-sm text-[#77716a]">/ 100</small></strong>
          </div>
          <div class="relative mt-5 h-2 rounded-full bg-[#dfdad0]"><div class="h-full rounded-full bg-[#b0761f]" :style="{ width: `${Number(topic.spectrumMedian || 0)}%` }" /></div>
          <div class="mt-6 rounded-xl border border-[#e0c9a0] bg-[#fffaf0] p-4">
            <div class="flex items-end justify-between">
              <span class="text-sm font-bold text-[#6d6861]">你的選擇</span>
              <strong class="text-2xl font-black tabular-nums text-[#b0761f]">{{ spectrumValue }}<small class="ml-1 text-xs text-[#77716a]">/ 100</small></strong>
            </div>
            <input v-model.number="spectrumValue" type="range" min="0" max="100" class="spec-range focus-ring mt-3 w-full accent-[#b0761f]" :disabled="voting" />
            <div class="mt-1 flex justify-between text-xs font-bold text-[#77716a]"><span>0</span><span>50</span><span>100</span></div>
            <UiButton variant="quick" block class="mt-4" :disabled="voting || spectrumUnchanged" @click="changeSpectrumVote">{{ voting ? '更新中…' : '更新我的分數' }}</UiButton>
          </div>
        </template>

        <template v-else-if="isQuick && isVotingOpen && showResults && topic.topicType === 'SHORT_ANSWER'">
          <p class="mb-4 flex items-center gap-2 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">
            <span aria-hidden="true">✓</span> 已作答 — 快問結果即時更新，回答可在此下方重新送出並更改。
          </p>
          <div class="max-h-72 space-y-2.5 overflow-y-auto pr-1">
            <ul v-if="topic.responses?.length" class="space-y-2.5">
              <li v-for="(response, index) in topic.responses" :key="index" class="rounded-xl border border-[#ded7cb] bg-white p-4">
                <p class="whitespace-pre-wrap text-sm leading-6">{{ response.answerText }}</p>
                <p class="mt-2 text-xs text-[#8b857d]">{{ response.nickname }} · {{ formatTime(response.createdAt) }}</p>
              </li>
            </ul>
            <p v-else class="text-sm text-[#8b857d]">還沒有公開回答，成為第一個作答的人。</p>
          </div>
        </template>

        <template v-else-if="isQuick && isVotingOpen && showResults && !showGameAgain">
          <p class="mb-4 flex items-center gap-2 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">
            <span aria-hidden="true">✓</span> 已投票 — 快問結果即時更新，點選其他選項即可更改票。
          </p>
          <button v-if="topic.topicType === 'SPIN_WHEEL' || topic.topicType === 'LOTTERY'" type="button" class="focus-ring mb-4 flex w-full items-center justify-between rounded-xl border border-[#3157d5] bg-[#e7ecff] px-4 py-3 text-left text-sm font-bold text-[#2746b4] transition hover:border-[#171717]" @click="showGameAgain = true">
            <span>再來一次，交給運氣決定下一票</span>
            <span aria-hidden="true">↻</span>
          </button>
          <div class="space-y-2.5">
            <button
              v-for="o in topic.options"
              :key="o.id"
              type="button"
              class="focus-ring block w-full overflow-hidden rounded-xl border-2 text-left transition"
              :class="myVoteOptionId === o.id ? 'border-[#b0761f] bg-[#fff8ec]' : 'border-[#ded7cb] bg-white hover:border-[#b0761f]'"
              :disabled="voting"
              @click="onOptionTap(o.id)"
            >
              <span class="flex items-center justify-between px-4 py-3 text-sm font-bold">
                <span class="flex items-center gap-2"><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}</span>
                <span class="flex items-center gap-2 tabular-nums">
                  <span v-if="voting && votingTargetId === o.id" class="size-4 animate-spin rounded-full border-2 border-[#b0761f] border-t-transparent" aria-hidden="true" />
                  <template v-else>{{ optionPercentage(o, topic) }}% · {{ o.voteCount }} 票</template>
                </span>
              </span>
              <span class="block h-1.5 bg-[#f0e6d2]"><span class="block h-full bg-[#b0761f] transition-[width] duration-500" :style="{ width: `${optionPercentage(o, topic)}%` }" /></span>
            </button>
          </div>
        </template>

        <template v-else>
          <template v-if="topic.topicType === 'SHORT_ANSWER'">
            <p class="mb-3 text-sm font-bold text-[#6d6861]">共 {{ topic.responses?.length ?? 0 }} 則回答，以下公開顯示：</p>
            <div class="max-h-80 space-y-2.5 overflow-y-auto pr-1">
              <ul v-if="topic.responses?.length" class="space-y-2.5">
                <li v-for="(response, index) in topic.responses" :key="index" class="rounded-xl border border-[#ded7cb] bg-white p-4">
                  <p class="whitespace-pre-wrap text-sm leading-6">{{ response.answerText }}</p>
                  <p class="mt-2 text-xs text-[#8b857d]">{{ response.nickname }} · {{ formatTime(response.createdAt) }}</p>
                </li>
              </ul>
              <p v-else class="text-sm text-[#8b857d]">還沒有公開回答。</p>
            </div>
          </template>
          <template v-else-if="topic.topicType === 'SPECTRUM'">
            <div class="flex items-end justify-between gap-4">
              <span class="text-sm font-bold text-[#6d6861]">社群中位數</span>
              <strong class="text-4xl font-black tabular-nums text-[#3157d5]">{{ Math.round(Number(topic.spectrumMedian || 0)) }}<small class="ml-1 text-sm text-[#77716a]">/ 100</small></strong>
            </div>
            <div class="relative mt-5 h-3 rounded-full bg-[#dfdad0]"><div class="h-full rounded-full bg-[#3157d5]" :style="{ width: `${Number(topic.spectrumMedian || 0)}%` }" /></div>
            <p v-if="topic.myVote" class="mt-4 rounded-xl border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-3 text-sm font-bold">你的選擇：{{ topic.myVote.choice }}</p>
          </template>
          <template v-else>
            <div class="space-y-5">
              <div v-for="o in topic.options" :key="o.id">
                <div class="mb-2 flex items-center justify-between gap-4 text-sm"><span class="font-bold">{{ o.label }}</span><span class="shrink-0 font-black tabular-nums">{{ optionPercentage(o, topic) }}% · {{ o.voteCount }} 票</span></div>
                <div class="h-2 rounded-full bg-[#dfdad0]"><div class="h-full rounded-full bg-[#3157d5] transition-[width] duration-500" :style="{ width: `${optionPercentage(o, topic)}%` }" /></div>
              </div>
            </div>
            <p v-if="topic.myVote" class="mt-5 rounded-xl border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-3 text-sm font-bold">你的選擇：{{ topic.myVote.choice }}</p>
          </template>
        </template>

        <p v-if="!isQuick && !showResults && isVotingOpen" class="mt-4 border-t border-[#ded7cb] pt-4 text-xs leading-5 text-[#77716a]">送出後無法修改。投票後可立即查看即時風向。</p>
      </div>
    </section>

    <section v-if="activeSection === 'context' && topic.blocks.length" class="max-w-3xl border-y-2 border-[#171717] bg-[#faf8f3]">
      <header class="flex flex-col gap-2 border-b border-[#d7d1c6] px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p class="eyebrow text-[#3157d5]">補充內容</p><h2 class="mt-1 text-xl font-black">了解議題脈絡</h2></div>
      </header>
      <div class="divide-y divide-[#d7d1c6]">
        <details v-for="(item, index) in topic.blocks" :key="item.id" :open="index < 2" class="group">
          <summary class="focus-ring flex cursor-pointer list-none items-start gap-4 px-5 py-4 marker:hidden">
            <span class="shrink-0 text-xl font-black text-[#c8c1b6]">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="min-w-0 flex-1"><small class="block text-[10px] font-black tracking-[0.14em] text-[#77716a]">{{ blockLabel(item.type) }}</small><strong class="mt-1 block leading-snug">{{ item.title }}</strong><small v-if="item.sourceLabel" class="mt-1 block text-[#77716a]">{{ item.sourceLabel }}</small></span>
            <span class="mt-2 text-lg font-black text-[#3157d5] group-open:rotate-45" aria-hidden="true">＋</span>
          </summary>
          <article class="px-5 pb-5 pl-[4.25rem]">
            <time v-if="item.occurredAt" class="text-xs text-[#77716a]">{{ formatCaseDate(item.occurredAt) }}</time>
            <p v-if="item.content" class="whitespace-pre-line text-sm leading-6 text-[#5f5a53]">{{ item.content }}</p>
            <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer" class="focus-ring mt-3 inline-block text-xs font-bold text-[#3157d5]">查看來源：{{ item.sourceLabel || '原始資料' }} &nearr;</a>
          </article>
        </details>
      </div>
    </section>

    <template v-if="activeSection === 'stances'">
    <StanceTree
      v-if="topicId"
      :topic-id="topicId"
      :topic-title="topic?.title || ''"
      :authed="auth.isAuthed"
      :open="isVotingOpen"
      :selected="selectedStance"
      :tab="selectedStanceTab"
      @select="selectStance"
      @tab="selectDetailTab"
    />
    </template>

    <StanceStatistics v-if="activeSection === 'statistics' && topicId" :topic-id="topicId" />

  </div>
</template>

<script setup lang="ts">
import type { Topic, TopicOption } from '~/types/topic';
import { getCategoryMeta, optionPercentage } from '~/utils/topic';

const route = useRoute();
const router = useRouter();
const api = useApi();
const auth = useAuthStore();
const { success: toastSuccess, error: toastError } = useToast();
const topicId = computed(() => route.params.id as string);
const loginUrl = computed(() => `/login?redirect=${encodeURIComponent(route.fullPath)}`);

const topic = ref<Topic | null>(null);
const loading = ref(true);
const pageError = ref('');
type TopicSection = 'vote' | 'context' | 'stances' | 'statistics';
const validSections: TopicSection[] = ['vote', 'context', 'stances', 'statistics'];
const initialSection = validSections.includes(route.query.section as TopicSection) ? route.query.section as TopicSection : 'vote';
const activeSection = ref<TopicSection>(initialSection);
const selectedStance = ref<string | null>(typeof route.query.stance === 'string' ? route.query.stance : null);
const selectedStanceTab = computed(() => route.query.tab === 'discussion' ? 'DISCUSSION' as const : 'DETAIL' as const);
const isVotingOpen = computed(() => topic.value?.status === 'OPEN' && !!topic.value.voteEndAt && new Date(topic.value.voteEndAt).getTime() > Date.now());
const participationReady = computed(() => !auth.isAuthed || Boolean(auth.capabilitySummary?.participation));
const showResults = computed(() => !!topic.value && (topic.value.hasVoted || !isVotingOpen.value || (auth.isAuthed && participationReady.value && !auth.canVote)));
const totalVotes = ref('0');
const voting = ref(false);
const votingTargetId = ref<string | null>(null);
const spectrumValue = ref(50);
const selectedOptionId = ref<string | null>(null);
const selectedOption = computed(() => topic.value?.options.find((option) => option.id === selectedOptionId.value) ?? null);
const confirmingOptionId = ref<string | null>(null);
const confirmingSpectrum = ref(false);
const myVoteOptionId = computed(() => topic.value?.options.find((option) => option.label === topic.value?.myVote?.choice)?.id ?? null);
const isQuick = computed(() => topic.value?.kind === 'QUICK');
const isInteractionLocked = computed(() => !auth.isAuthed);
const shortAnswerText = ref('');
const matchingLeftId = ref<string | null>(null);
const scratchProgress = reactive<Record<string, number>>({});
let scratchTimer: ReturnType<typeof setInterval> | null = null;
const wheelDeg = ref(0);
const wheelSpinning = ref(false);
const puzzleProgress = reactive<Record<string, number>>({});
const puzzleShuffles = shallowReactive<Record<string, string[]>>({});
const lotteryState = ref<'idle' | 'shaking' | 'drawing' | 'result'>('idle');
const lotteryResultId = ref<string | null>(null);
const lotteryDrawId = ref<string | null>(null);
const lotteryDrawNumber = computed(() => {
  const index = topic.value?.options.findIndex((option) => option.id === lotteryDrawId.value) ?? -1;
  return index >= 0 ? index + 1 : '';
});
const lotteryStatusLabel = computed(() => {
  if (lotteryState.value === 'shaking') return '搖獎中…';
  if (lotteryState.value === 'drawing') return '開獎…';
  if (lotteryState.value === 'result') return '抽中了！搖中哪顆即投哪票';
  return '每顆球代表一個選項，搖中即送出';
});
const wheelHitIndex = ref<number | null>(null);
const showGameAgain = ref(false);
const wheelConfettiKey = ref('');
const lotteryConfettiKey = ref('');
const matchingPending = ref(false);
const matchedPair = ref<[string, string] | null>(null);
const matchingWrong = ref<string | null>(null);
const scratchDoneId = ref<string | null>(null);
const puzzleJustIndex = ref<{ optionId: string; index: number } | null>(null);
const puzzleWrongRow = ref<string | null>(null);
const puzzleDoneId = ref<string | null>(null);
const mySpectrumValue = computed(() => {
  const value = topic.value?.myVote?.spectrumValue;
  return value != null ? Number(value) : null;
});
const spectrumUnchanged = computed(() => mySpectrumValue.value !== null && spectrumValue.value === mySpectrumValue.value);
const wheelColors = ['#b0761f', '#3157d5', '#3f7a58', '#9a6a12', '#7c3aed', '#c2410c', '#0e7490', '#be185d'];
const sections = computed<Array<{ value: TopicSection; label: string; count: number | null }>>(() => {
  if (isQuick.value) return [{ value: 'vote', label: '即時結果', count: null }];
  return [
    { value: 'vote', label: showResults.value ? '投票結果' : '我的選擇', count: null },
    ...((topic.value?.blocks.length ?? 0) ? [{ value: 'context' as const, label: '議題脈絡', count: topic.value!.blocks.length }] : []),
    { value: 'stances', label: '立場探索', count: null },
    ...(auth.canViewAnalytics ? [{ value: 'statistics' as const, label: '統計數據', count: null }] : []),
  ];
});

const { joinTopic, leaveTopic, onVoteUpdate, cleanup: cleanupRealtime } = useRealtime();
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCaseDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

function shuffleArray(items: string[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function preparePuzzle(data: Topic | null) {
  for (const option of data?.options ?? []) {
    if (!puzzleShuffles[option.id]) puzzleShuffles[option.id] = shuffleArray([...option.label]);
  }
}

function polar(radius: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)];
}

function wheelArc(index: number): string {
  const count = topic.value?.options.length ?? 0;
  const size = 360 / Math.max(count, 1);
  const [x0, y0] = polar(98, index * size);
  const [x1, y1] = polar(98, index * size + size);
  return `M100 100 L${x0.toFixed(2)} ${y0.toFixed(2)} A98 98 0 ${size > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function wheelLabel(index: number) {
  const count = topic.value?.options.length ?? 0;
  const size = 360 / Math.max(count, 1);
  const mid = index * size + size / 2;
  const [x, y] = polar(62, mid);
  return { x, y, rotate: mid };
}

async function setSection(section: TopicSection) {
  activeSection.value = section;
  await router.replace({ query: { ...route.query, section, stance: section === 'stances' ? selectedStance.value || undefined : undefined, tab: section === 'stances' ? route.query.tab : undefined } });
}

async function selectStance(stanceId: string | null) {
  selectedStance.value = stanceId;
  await router.replace({ query: { ...route.query, section: 'stances', stance: stanceId || undefined, tab: undefined } });
}

async function selectDetailTab(tab: 'DETAIL' | 'DISCUSSION') {
  await router.replace({ query: { ...route.query, section: 'stances', stance: selectedStance.value || undefined, tab: tab === 'DISCUSSION' ? 'discussion' : undefined } });
}

function blockLabel(type: Topic['blocks'][number]['type']) {
  return {
    BACKGROUND: '背景說明',
    CASE: '具體案例',
    DATA: '數據資料',
    SOURCE: '來源連結',
    PERSPECTIVES: '多方觀點',
  }[type];
}

function applyUpdate(data: any) {
  if (data?.topicId !== topicId.value) return;
  if (data.totalVotes) totalVotes.value = data.totalVotes;
  // Refresh authoritative counts from the server after a realtime tick.
  if (refreshTimer) clearTimeout(refreshTimer);
  const expectedId = topicId.value;
  refreshTimer = setTimeout(async () => {
    try {
      const fresh = await api.get<Topic>(`/topics/${expectedId}`);
      if (topicId.value !== expectedId) return;
      topic.value = fresh;
      totalVotes.value = fresh.totalVotes;
      preparePuzzle(fresh);
      if (fresh.topicType === 'SPECTRUM' && fresh.myVote?.spectrumValue != null) spectrumValue.value = Number(fresh.myVote.spectrumValue);
    } catch {
      // The next successful realtime tick or manual navigation will refresh the data.
    }
  }, 100);
}

async function load() {
  const expectedId = topicId.value;
  loading.value = true;
  pageError.value = '';
  try {
    const fresh = await api.get<Topic>(`/topics/${expectedId}`);
    if (topicId.value !== expectedId) return;
    topic.value = fresh;
    totalVotes.value = fresh.totalVotes;
  } catch (cause) {
    if (topicId.value !== expectedId) return;
    topic.value = null;
    pageError.value = errorMessage(cause);
  } finally {
    if (topicId.value === expectedId) loading.value = false;
  }
}

function resetVoteIntents() {
  selectedOptionId.value = null;
  confirmingOptionId.value = null;
  confirmingSpectrum.value = false;
  votingTargetId.value = null;
}

function onOptionTap(optionId: string) {
  if (!auth.isAuthed || voting.value || !isVotingOpen.value) return;
  const option = topic.value?.options.find((item) => item.id === optionId);
  if (!option) return;
  if (topic.value?.hasVoted) {
    void changeQuickVote(option);
    return;
  }
  if (isQuick.value) {
    void submitQuickVote(option);
    return;
  }
  selectedOptionId.value = optionId;
  confirmingOptionId.value = option.id;
}

async function submitShortAnswer() {
  const text = shortAnswerText.value.trim();
  if (voting.value || !text) return;
  voting.value = true;
  try {
    const res = await api.post<{ newBalance: string; rewardPoints: number }>(`/topics/${topicId.value}/vote`, { answerText: text });
    auth.updatePoints(res.newBalance);
    toastSuccess(res.rewardPoints > 0 ? `已送出回答，獲得 ${res.rewardPoints} 點` : '已送出回答');
    await load();
  } catch (e) {
    toastError(errorMessage(e));
    await load();
  } finally {
    voting.value = false;
  }
}

async function changeSpectrumVote() {
  if (voting.value || mySpectrumValue.value === null) return;
  voting.value = true;
  try {
    const res = await api.patch<{ newBalance: string; rewardPoints: number }>(`/topics/${topicId.value}/vote`, { spectrumValue: spectrumValue.value });
    auth.updatePoints(res.newBalance);
    toastSuccess(`已更改為 ${spectrumValue.value} 分`);
    await load();
  } catch (e) {
    toastError(errorMessage(e));
    await load();
  } finally {
    voting.value = false;
  }
}

function scratchStart(optionId: string) {
  if (voting.value || isInteractionLocked.value || scratchTimer) return;
  scratchTimer = setInterval(() => {
    scratchProgress[optionId] = Math.min(1, (scratchProgress[optionId] ?? 0) + 0.06);
    if (scratchProgress[optionId] >= 1) {
      scratchStop();
      scratchDoneId.value = optionId;
      const option = topic.value?.options.find((item) => item.id === optionId);
      if (option) window.setTimeout(() => void submitQuickVote(option), 380);
    }
  }, 70);
}

function scratchStop() {
  if (scratchTimer) {
    clearInterval(scratchTimer);
    scratchTimer = null;
  }
}

function onMatchingLeft(optionId: string) {
  if (voting.value || isInteractionLocked.value) return;
  matchingLeftId.value = matchingLeftId.value === optionId ? null : optionId;
}

function onMatchingRight(optionId: string) {
  if (voting.value || matchingPending.value || isInteractionLocked.value) return;
  const leftId = matchingLeftId.value;
  if (!leftId || leftId === optionId) return;
  const left = topic.value?.options.find((option) => option.id === leftId);
  const right = topic.value?.options.find((option) => option.id === optionId);
  matchingLeftId.value = null;
  if (left && right && left.label === right.data?.match) {
    matchingPending.value = true;
    matchedPair.value = [leftId, optionId];
    window.setTimeout(() => {
      matchingPending.value = false;
      matchedPair.value = null;
      void submitQuickVote(right);
    }, 340);
  } else {
    matchingWrong.value = optionId;
    toastError('配對錯誤，請再試一次');
    window.setTimeout(() => {
      matchingWrong.value = null;
    }, 720);
  }
}

function onPuzzleTile(optionId: string, index: number, letter: string) {
  if (voting.value || isInteractionLocked.value || puzzleDoneId.value === optionId) return;
  const option = topic.value?.options.find((item) => item.id === optionId);
  if (!option) return;
  const progress = puzzleProgress[optionId] ?? 0;
  if (letter === option.label[progress]) {
    puzzleProgress[optionId] = progress + 1;
    puzzleJustIndex.value = { optionId, index };
    window.setTimeout(() => {
      if (puzzleJustIndex.value?.optionId === optionId && puzzleJustIndex.value?.index === index) puzzleJustIndex.value = null;
    }, 320);
    if (puzzleProgress[optionId] >= option.label.length) {
      puzzleDoneId.value = optionId;
      window.setTimeout(() => void submitQuickVote(option), 380);
    }
  } else {
    puzzleProgress[optionId] = 0;
    puzzleWrongRow.value = optionId;
    toastError('順序不對，拼圖已打亂重來');
    window.setTimeout(() => {
      puzzleWrongRow.value = null;
    }, 760);
  }
}

function weightedIndex(): number {
  const options = topic.value?.options ?? [];
  const weights = options.map((option) => Math.max(Number(option.data?.weight ?? 1), 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) return i;
  }
  return weights.length - 1;
}

function spinWheel() {
  const options = topic.value?.options ?? [];
  if (!options.length || wheelSpinning.value || voting.value || isInteractionLocked.value) return;
  const idx = weightedIndex();
  const size = 360 / options.length;
  const phi = idx * size + Math.random() * size;
  const desired = (360 - (phi % 360) + 360) % 360;
  const current = ((wheelDeg.value % 360) + 360) % 360;
  const delta = ((desired - current + 360) % 360) + 1080;
  wheelSpinning.value = true;
  wheelHitIndex.value = null;
  wheelDeg.value += delta;
  window.setTimeout(() => {
    wheelSpinning.value = false;
    const option = options[idx];
    wheelHitIndex.value = idx;
    wheelConfettiKey.value = `${option.id}-${Date.now()}`;
    window.setTimeout(async () => {
      wheelHitIndex.value = null;
      showGameAgain.value = false;
      await submitLanded(option);
    }, 620);
  }, 2800);
}

function shakeLottery() {
  const options = topic.value?.options ?? [];
  if (!options.length || lotteryState.value === 'shaking' || lotteryState.value === 'drawing' || voting.value || isInteractionLocked.value) return;
  lotteryResultId.value = null;
  lotteryDrawId.value = null;
  lotteryState.value = 'shaking';
  const idx = Math.floor(Math.random() * options.length);
  window.setTimeout(() => {
    const option = options[idx];
    lotteryDrawId.value = option.id;
    lotteryState.value = 'drawing';
    window.setTimeout(() => {
      lotteryState.value = 'result';
      lotteryResultId.value = option.id;
      lotteryConfettiKey.value = `${option.id}-${Date.now()}`;
      window.setTimeout(async () => {
        lotteryResultId.value = null;
        lotteryState.value = 'idle';
        showGameAgain.value = false;
        await submitLanded(option);
      }, 620);
    }, 520);
  }, 1080);
}

async function submitLanded(option: TopicOption) {
  if (voting.value) return;
  if (option.id === myVoteOptionId.value) return;
  if (topic.value?.hasVoted) await changeQuickVote(option);
  else await submitQuickVote(option);
}

async function submitVote() {
  if (voting.value) return;
  const isSpectrum = topic.value?.topicType === 'SPECTRUM';
  if (!isSpectrum && !selectedOption.value) return;
  voting.value = true;
  votingTargetId.value = selectedOption.value?.id ?? null;
  try {
    const body = isSpectrum
      ? { spectrumValue: spectrumValue.value }
      : { optionId: selectedOption.value!.id };
    const res = await api.post<{ newBalance: string; rewardPoints: number }>(`/topics/${topicId.value}/vote`, body);
    auth.updatePoints(res.newBalance);
    const choice = isSpectrum ? `${spectrumValue.value} 分` : selectedOption.value!.label;
    toastSuccess(res.rewardPoints > 0 ? `已投下「${choice}」，獲得 ${res.rewardPoints} 點` : `已投下「${choice}」`);
    resetVoteIntents();
    await load();
  } catch (e) {
    resetVoteIntents();
    toastError(errorMessage(e));
    await load();
  } finally {
    voting.value = false;
  }
}

async function submitQuickVote(option: TopicOption) {
  voting.value = true;
  votingTargetId.value = option.id;
  try {
    const res = await api.post<{ newBalance: string; rewardPoints: number }>(`/topics/${topicId.value}/vote`, { optionId: option.id });
    auth.updatePoints(res.newBalance);
    votingTargetId.value = null;
    toastSuccess('已投票，快問結果即時更新');
    await load();
  } catch (e) {
    votingTargetId.value = null;
    toastError(errorMessage(e));
    await load();
  } finally {
    voting.value = false;
  }
}

async function changeQuickVote(option: TopicOption) {
  if (voting.value || option.id === myVoteOptionId.value) return;
  voting.value = true;
  votingTargetId.value = option.id;
  try {
    const res = await api.patch<{ newBalance: string; rewardPoints: number }>(`/topics/${topicId.value}/vote`, { optionId: option.id });
    auth.updatePoints(res.newBalance);
    votingTargetId.value = null;
    toastSuccess(`已更改為「${option.label}」`);
    await load();
  } catch (e) {
    votingTargetId.value = null;
    toastError(errorMessage(e));
    await load();
  } finally {
    voting.value = false;
  }
}

onMounted(async () => {
  if (route.query.section && !validSections.includes(route.query.section as TopicSection)) {
    await router.replace({ query: { ...route.query, section: 'vote', stance: undefined } });
  }
  await load();
  joinTopic(topicId.value);
  onVoteUpdate(applyUpdate);
});
watch(topicId, async (nextId, previousId) => {
  leaveTopic(previousId);
  selectedStance.value = null;
  showGameAgain.value = false;
  resetVoteIntents();
  activeSection.value = validSections.includes(route.query.section as TopicSection) ? route.query.section as TopicSection : 'vote';
  await load();
  joinTopic(nextId);
});
watch(() => route.query.section, async (section) => {
  if (validSections.includes(section as TopicSection) && (section !== 'statistics' || auth.canViewAnalytics)) {
    activeSection.value = section as TopicSection;
  } else {
    activeSection.value = 'vote';
    if (section) await router.replace({ query: { ...route.query, section: 'vote', stance: undefined } });
  }
});
watch(() => auth.canViewAnalytics, (allowed) => {
  if (!allowed && activeSection.value === 'statistics') setSection('vote');
});
watch(() => route.query.stance, (stance) => {
  selectedStance.value = typeof stance === 'string' ? stance : null;
});
onUnmounted(() => {
  if (refreshTimer) clearTimeout(refreshTimer);
  scratchStop();
  cleanupRealtime();
});
</script>

<style scoped>
.lottery-shake {
  animation: lottery-shake 0.4s ease-in-out infinite;
}
@keyframes lottery-shake {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(-3px, 2px) rotate(-2deg);
  }
  50% {
    transform: translate(3px, -2px) rotate(2deg);
  }
  75% {
    transform: translate(-2px, -3px) rotate(1deg);
  }
}

/* 轉盤 */
.wheel-pointer {
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 16px solid #d84a36;
  filter: drop-shadow(0 2px 3px rgba(23, 23, 23, 0.35));
  animation: pointer-bob 1.8s ease-in-out infinite;
  transform-origin: 50% 0;
}
@keyframes pointer-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(5px);
  }
}
.wheel-hub {
  transition: filter 0.25s ease;
}
.hub-pulse {
  animation: hub-pulse 2.4s ease-in-out infinite;
}
@keyframes hub-pulse {
  0%,
  100% {
    filter: drop-shadow(0 0 2px rgba(176, 118, 31, 0.25));
  }
  50% {
    filter: drop-shadow(0 0 9px rgba(176, 118, 31, 0.55));
  }
}
.wheel-sheen {
  background: conic-gradient(from 0deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0) 12%, rgba(255, 255, 255, 0) 88%, rgba(255, 255, 255, 0.4));
  animation: wheel-sheen 1.1s linear infinite;
}
@keyframes wheel-sheen {
  to {
    transform: rotate(360deg);
  }
}
.wheel-hit {
  animation: wheel-hit-flash 0.7s ease 2;
}
@keyframes wheel-hit-flash {
  0%,
  100% {
    stroke: #fffaf0;
    stroke-width: 1.5;
    filter: none;
  }
  45% {
    stroke: #ffffff;
    stroke-width: 3.5;
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.95));
  }
}
.game-chip-in {
  animation: chip-in 0.32s cubic-bezier(0.22, 0.9, 0.35, 1.2) both;
}
@keyframes chip-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 搖獎箱 */
.lottery-lid {
  background: linear-gradient(180deg, #c9a15e, #a8792f);
  border-radius: 10px 10px 0 0;
}
.lottery-lid-knob {
  display: block;
  height: 8px;
  width: 26px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.35);
}
.lottery-shell {
  background: linear-gradient(180deg, #fffdf8, #f3e7cf);
  border: 1px solid #e0c9a0;
  border-radius: 0 0 14px 14px;
  box-shadow: inset 0 -6px 14px -8px rgba(143, 93, 20, 0.35);
}
.lottery-ball {
  transition: transform 0.25s ease, background 0.25s ease, color 0.25s ease;
}
.lottery-ball-hit {
  border-color: #b0761f;
  background: #b0761f;
  color: #ffffff;
  transform: scale(1.08);
  animation: ball-hit 0.5s ease 2;
}
@keyframes ball-hit {
  0%,
  100% {
    box-shadow: 0 0 0 rgba(176, 118, 31, 0);
  }
  50% {
    box-shadow: 0 0 14px rgba(176, 118, 31, 0.75);
  }
}
.lottery-light-beam {
  width: 2px;
  height: 84px;
  background: linear-gradient(180deg, rgba(255, 241, 201, 0), rgba(255, 220, 140, 0.85), rgba(255, 241, 201, 0));
  animation: beam-waver 0.5s ease-in-out infinite alternate;
}
@keyframes beam-waver {
  from {
    opacity: 0.55;
    transform: translateX(-50%) scaleY(1);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) scaleY(1.08);
  }
}
.lottery-draw-ball {
  animation: draw-pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
  position: relative;
}
@keyframes draw-pop {
  0% {
    opacity: 0;
    transform: translateY(6px) scale(0.4);
  }
  60% {
    opacity: 1;
    transform: translateY(-34px) scale(1.15);
  }
  100% {
    opacity: 1;
    transform: translateY(-24px) scale(1);
  }
}

/* 刮刮樂 */
.scratch-pattern {
  background-image:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0, rgba(255, 255, 255, 0.5) 1.5px, transparent 1.5px, transparent 7px);
}
.scratch-shine {
  background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.45) 45%, transparent 60%);
  background-size: 200% 100%;
  animation: scratch-shine 2.4s ease-in-out infinite;
}
@keyframes scratch-shine {
  0%,
  60% {
    background-position: 120% 0;
  }
  100% {
    background-position: -60% 0;
  }
}
.scratch-wiggle {
  animation: scratch-wiggle 0.22s ease-in-out infinite;
}
@keyframes scratch-wiggle {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  50% {
    transform: translate(0.5px, 1px) rotate(0.6deg);
  }
}
.scratch-win {
  animation: scratch-win 0.45s ease-out;
}
@keyframes scratch-win {
  0% {
    box-shadow: 0 0 0 rgba(63, 122, 88, 0);
    transform: scale(1);
  }
  45% {
    box-shadow: 0 0 0 10px rgba(63, 122, 88, 0.18);
    transform: scale(1.05);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(63, 122, 88, 0);
    transform: scale(1);
  }
}

/* 拼圖 */
.tile-pop {
  animation: tile-pop 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.4);
}
@keyframes tile-pop {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}
.tile-assemble {
  animation: tile-assemble 0.45s ease-out both;
}
@keyframes tile-assemble {
  from {
    transform: scale(1.25) rotate(4deg);
    box-shadow: 0 0 0 6px rgba(63, 122, 88, 0.25);
  }
  to {
    transform: scale(1) rotate(0deg);
    box-shadow: 0 0 0 0 rgba(63, 122, 88, 0);
  }
}
.puzzle-row-shake {
  animation: puzzle-row-shake 0.4s ease-in-out;
}
@keyframes puzzle-row-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

/* 連連看 */
.matching-picked,
.matching-ready {
  animation: matching-glow 1.5s ease-in-out infinite;
}
@keyframes matching-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(49, 87, 213, 0.22);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(49, 87, 213, 0);
  }
}
.match-success {
  animation: match-success 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.3);
}
@keyframes match-success {
  0% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.06);
  }
  100% {
    transform: scale(1);
  }
}
.match-wrong {
  animation: match-wrong 0.4s ease-in-out;
}
@keyframes match-wrong {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

/* 光譜滑桿 */
.spec-range::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(90deg, #3f7a58, #b0761f 55%, #3157d5);
}
.spec-range::-moz-range-track {
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(90deg, #3f7a58, #b0761f 55%, #3157d5);
}
.spec-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -7px;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  background: #ffffff;
  border: 3px solid #b0761f;
  box-shadow: 0 1px 4px rgba(23, 23, 23, 0.25);
  transition: transform 0.15s ease;
}
.spec-range::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

@media (prefers-reduced-motion: reduce) {
  .wheel-pointer,
  .hub-pulse,
  .wheel-sheen,
  .wheel-hit,
  .lottery-shake,
  .lottery-ball-hit,
  .lottery-light-beam,
  .lottery-draw-ball,
  .game-chip-in,
  .scratch-shine,
  .scratch-wiggle,
  .scratch-win,
  .tile-pop,
  .tile-assemble,
  .puzzle-row-shake,
  .matching-picked,
  .matching-ready,
  .match-success,
  .match-wrong {
    animation: none;
  }
}
</style>
