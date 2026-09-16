<template>
  <div>
    <UiImageLightbox v-model:src="lightboxSrc" />
    <div v-if="!showResults && isVotingOpen && !participationReady" class="h-24 animate-pulse rounded-xl bg-[#eee9e0]" />
    <div v-else-if="!showResults && isVotingOpen && auth.isAuthed && !auth.canVote" class="rounded-xl border border-[#e6cf9e] bg-[#fff8ec] p-4 text-sm font-bold text-[#8f5d14]">{{ VOTE_IDENTITY_NOTICE }}</div>

    <template v-else-if="!showResults && isVotingOpen && topic.topicType === 'SPECTRUM'">
      <div class="flex items-end justify-between">
        <span class="text-sm font-bold text-[#6d6861]">目前選擇</span>
        <strong class="text-4xl font-black tabular-nums text-[#3157d5]">{{ spectrumValue }}<small class="ml-1 text-sm text-[#77716a]">/ 100</small></strong>
      </div>
      <input v-model.number="spectrumValue" type="range" min="0" max="100" class="spec-range focus-ring mt-5 w-full accent-[#3157d5]" :class="{ 'cursor-not-allowed opacity-60': isInteractionLocked }" :disabled="isInteractionLocked" />
      <div class="mt-2 flex justify-between text-xs font-bold text-[#77716a]"><span>0</span><span>50</span><span>100</span></div>
      <UiButton v-if="!isInteractionLocked" variant="data" block class="mt-6" :disabled="voting" @click="submitSpectrumVote">
        {{ voting ? '送出中…' : `確認送出 ${spectrumValue} 分` }}
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

    <template v-else-if="isVotingOpen && topic.topicType === 'MATCHING'">
      <p v-if="hasVotedGame" class="mb-4 flex items-center gap-2 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">
        <span aria-hidden="true">✓</span> 已投「{{ votedChoice }}」— 配對正確即完成換票。
      </p>
      <p v-else class="text-sm leading-6 text-[#6d6861]">先點左側項目，再點右側對應的配對。配對正確即完成投票。</p>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="space-y-2">
          <button v-for="o in topic.options" :key="o.id" type="button" class="focus-ring relative flex min-h-12 w-full items-center rounded-xl border-2 bg-white px-3 py-2.5 text-left text-sm font-bold transition" :class="[matchedPair?.includes(o.id) ? 'match-success border-[#3f7a58] bg-[#e5f1e9] text-[#3f7a58]' : '', matchingLeftId === o.id ? 'matching-picked border-[#3157d5] bg-[#e7ecff] text-[#3157d5]' : 'border-[#ded7cb]']" :disabled="voting || matchingPending || isInteractionLocked || !!matchedPair" @click="onMatchingLeft(o.id)">
            <span class="min-w-0">{{ o.label }}</span>
            <span v-if="matchingLeftId === o.id" class="ml-2 text-[#3157d5]" aria-hidden="true">●</span>
          </button>
        </div>
        <div class="space-y-2">
          <button v-for="o in topic.options" :key="o.id" type="button" class="focus-ring flex min-h-12 w-full items-center rounded-xl border-2 border-dashed bg-white px-3 py-2.5 text-left text-sm font-bold transition" :class="[matchedPair?.includes(o.id) ? 'match-success border-[#3f7a58] bg-[#e5f1e9] text-[#3f7a58]' : '', matchingWrong === o.id ? 'match-wrong border-[#d84a36] bg-[#fbe9e5] text-[#a63222]' : '', matchingLeftId ? 'matching-ready border-[#3157d5] text-[#3157d5]' : 'border-[#cfc8bc] text-[#8b857d]']" :disabled="voting || matchingPending || isInteractionLocked || !!matchedPair || !matchingLeftId" @click="onMatchingRight(o.id)">{{ o.data?.match }}</button>
        </div>
      </div>
      <p v-if="matchingPending" class="mt-3 text-center text-xs font-bold text-[#3f7a58]">配對成功！送出中…</p>
      <div class="mt-3 text-center">
        <button v-if="matchedPair && hasVotedGame" type="button" class="focus-ring text-xs font-bold text-[#3157d5] hover:underline" @click="resetMatching">重新配對（換票）</button>
      </div>
      <UiQuickMiniResults v-if="topic.hasVoted" :topic="topic" class="mt-5" />
    </template>

    <template v-else-if="isVotingOpen && topic.topicType === 'PUZZLE'">
      <p v-if="hasVotedGame" class="mb-4 flex items-center gap-2 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">
        <span aria-hidden="true">✓</span> 已投「{{ votedChoice }}」— 拼出另一詞即完成換票。
      </p>
      <p v-else class="text-sm leading-6 text-[#6d6861]">把下方打亂的字塊依正確順序點回原詞，拼完即完成投票。</p>
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
      <UiQuickMiniResults v-if="topic.hasVoted" :topic="topic" class="mt-5" />
    </template>

    <template v-else-if="isVotingOpen && topic.topicType === 'SCRATCH'">
      <p v-if="hasVotedGame" class="mb-4 flex items-center gap-2 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">
        <span aria-hidden="true">✓</span> 已投「{{ votedChoice }}」— 刮開另一張即完成換票。
      </p>
      <p v-else class="text-sm leading-6 text-[#6d6861]">按住卡片刮開偽裝貼紙，刮到底即投下那一票。</p>
      <div class="mt-4 grid grid-cols-3 gap-3" @mouseup="scratchStop" @mouseleave="scratchStop" @touchend="scratchStop">
        <button v-for="(o, index) in topic.options" :key="o.id" type="button" class="focus-ring relative aspect-square select-none overflow-hidden rounded-2xl border-2 bg-white text-xs font-black transition" :class="[voting || isInteractionLocked || (hasVotedGame && !redoMode) ? 'opacity-75' : 'cursor-pointer touch-none', (scratchProgress[o.id] ?? 0) > 0 && (scratchProgress[o.id] ?? 0) < 1 && !(hasVotedGame && !redoMode) ? 'scratch-wiggle' : '', votedOptionId === o.id && !redoMode ? 'scratch-win border-[#3f7a58]' : 'border-[#ded7cb]']" :disabled="voting || isInteractionLocked || (hasVotedGame && !redoMode)" @mousedown="scratchStart(o.id)" @touchstart.prevent="scratchStart(o.id)">
          <span class="grid h-full w-full place-items-center px-1 text-center leading-tight" :class="votedOptionId === o.id && !redoMode ? 'text-[#3f7a58]' : ''">{{ o.label }}</span>
          <span v-if="votedOptionId === o.id && !redoMode" class="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-2xl text-[#3f7a58]" aria-hidden="true">✓</span>
          <span class="scratch-pattern absolute inset-0 grid place-items-center rounded-xl bg-gradient-to-br from-[#9a6a12] to-[#c9a15e] text-xl font-black text-white" :style="{ opacity: hasVotedGame && !redoMode ? 0 : 1 - (scratchProgress[o.id] ?? 0) }">
            <span class="scratch-shine pointer-events-none absolute inset-0" />
            <span class="grid h-full w-full place-items-center">{{ (scratchProgress[o.id] ?? 0) > 0 ? '刮' : '？' }}</span>
            <span class="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-black/20 text-[10px] font-bold">{{ index + 1 }}</span>
          </span>
          <UiConfetti v-if="scratchDoneId === o.id" :burst-key="`scratch-${o.id}`" :count="10" />
        </button>
      </div>
      <div class="mt-3 text-center">
        <button v-if="hasVotedGame" type="button" class="focus-ring text-xs font-bold text-[#3157d5] hover:underline" @click="resetScratch">重刮（換票）</button>
      </div>
      <UiQuickMiniResults v-if="topic.hasVoted" :topic="topic" class="mt-5" />
    </template>

    <template v-else-if="isVotingOpen && topic.topicType === 'SPIN_WHEEL'">
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
              <path :d="wheelArc(index)" :fill="wheelColors[index % wheelColors.length]" stroke="#fffaf0" stroke-width="1.5" :class="{ 'wheel-hit': (wheelHitIndex ?? votedOptionIndex) === index }" />
              <text :x="wheelLabel(index).x" :y="wheelLabel(index).y" :transform="`rotate(${wheelLabel(index).rotate} ${wheelLabel(index).x} ${wheelLabel(index).y})`" text-anchor="middle" font-size="12" font-weight="700" fill="#fffaf0">{{ o.label }}</text>
            </g>
            <circle cx="100" cy="100" r="21" fill="url(#wheel-hub-grad)" stroke="#ded7cb" stroke-width="2" class="wheel-hub" :class="{ 'hub-pulse': !wheelSpinning }" />
            <text x="100" y="105" text-anchor="middle" font-size="13" font-weight="900" fill="#8f5d14">GO</text>
          </svg>
          <span v-if="wheelSpinning" class="wheel-sheen pointer-events-none absolute inset-0 rounded-full" aria-hidden="true" />
          <UiConfetti v-if="wheelHitIndex !== null" :burst-key="`wheel-${wheelConfettiKey}`" :count="14" />
        </div>
        <div class="mt-4 flex flex-col items-center gap-1.5 text-center">
          <p v-if="hasVotedGame" class="text-xs font-bold text-[#8f5d14]">你轉到了「{{ votedChoice }}」</p>
          <UiButton variant="data" :disabled="wheelSpinning || voting || isInteractionLocked" @click="spinWheel">{{ wheelSpinning ? '轉動中…' : hasVotedGame ? '再抽一次（換票）' : '轉一次！' }}</UiButton>
        </div>
      </div>
      <UiQuickMiniResults v-if="topic.hasVoted" :topic="topic" class="mt-5" />
    </template>

    <template v-else-if="isVotingOpen && topic.topicType === 'LOTTERY'">
      <div class="rounded-2xl border border-[#e0c9a0] bg-gradient-to-b from-[#fffaf0] to-[#fdf3e0] p-5">
        <div class="relative mx-auto max-w-sm overflow-hidden rounded-xl">
          <div class="lottery-shell relative">
            <div class="lottery-lid relative flex items-center justify-between px-4 py-2">
              <span class="lottery-lid-knob" aria-hidden="true" />
              <span class="text-[10px] font-black tracking-[0.18em] text-[#8f5d14]">{{ lotteryState === 'result' ? '抽籤完成' : '搖獎箱' }}</span>
              <span class="lottery-lid-knob" aria-hidden="true" />
            </div>
            <div class="relative mx-auto flex h-40 flex-wrap items-center justify-center gap-2 px-3" :class="{ 'lottery-shake': lotteryState === 'shaking' }">
              <span v-for="(o, index) in topic.options" :key="o.id" class="lottery-ball grid size-14 place-items-center rounded-full border text-sm font-black shadow-sm" :class="(lotteryResultId ?? votedOptionId) === o.id ? 'lottery-ball-hit' : 'border-[#e0c9a0] bg-white text-[#8f5d14]'">{{ (lotteryResultId ?? votedOptionId) === o.id ? votedChoice : index + 1 }}</span>
              <span v-if="lotteryState === 'drawing'" class="lottery-light-beam pointer-events-none absolute left-1/2 top-10 z-10 -translate-x-1/2" aria-hidden="true" />
            </div>
          </div>
          <div v-if="lotteryState === 'drawing'" class="lottery-draw-wrap pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center">
            <span class="lottery-draw-ball grid size-14 place-items-center rounded-full border border-[#b0761f] bg-white text-sm font-black text-[#8f5d14] shadow-lg">{{ lotteryDrawNumber }}<span class="absolute -bottom-5 text-[9px] font-bold text-[#b0761f]">出球中</span></span>
          </div>
          <UiConfetti v-if="lotteryState === 'result'" :burst-key="`lottery-${lotteryConfettiKey}`" :count="14" />
        </div>
        <p class="mt-3 text-center text-xs font-bold text-[#8f5d14]">{{ hasVotedGame ? `抽到了「${votedChoice}」` : lotteryStatusLabel }}</p>
        <div class="mt-3 flex flex-col items-center gap-1.5 text-center">
          <UiButton variant="data" :disabled="lotteryState === 'shaking' || lotteryState === 'drawing' || voting || isInteractionLocked" @click="shakeLottery">{{ voting ? '送出中…' : hasVotedGame ? '再搖一次（換票）' : '搖一搖' }}</UiButton>
        </div>
      </div>
      <UiQuickMiniResults v-if="topic.hasVoted" :topic="topic" class="mt-5" />
    </template>

    <template v-else-if="!showResults && isVotingOpen && isOptionPick">
      <div class="space-y-2.5">
        <button
          v-for="o in visibleOptions"
          :key="o.id"
          type="button"
          class="focus-ring flex min-h-12 w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left font-bold transition"
          :class="[myVoteOptionId === o.id ? 'border-[#b0761f] bg-[#fff8ec] text-[#8f5d14]' : 'border-[#ded7cb] bg-white hover:border-[#171717]']"
          :disabled="voting || isInteractionLocked"
          @click="submitQuickVote(o.id)"
        >
          <span class="flex items-center gap-3">
            <span>{{ o.label }}</span>
          </span>
          <span aria-hidden="true">{{ myVoteOptionId === o.id ? '✓' : '○' }}</span>
        </button>
      </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-3 w-full rounded-xl border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${topic.options.length}）` }}</button>
    </template>

    <template v-else-if="!showResults && isVotingOpen && isImageOption">
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="o in topic.options"
          :key="o.id"
          class="focus-ring group relative aspect-square overflow-hidden rounded-2xl border-2 bg-white transition"
          :class="myVoteOptionId === o.id ? 'border-[#b0761f] ring-2 ring-[#b0761f]' : 'border-[#e0c9a0] hover:border-[#b0761f]'"
        >
          <img :src="o.data?.imageUrl" :alt="o.label" class="absolute inset-0 h-full w-full object-cover" />
          <span class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8 text-xs font-black text-white">{{ o.label }}</span>
          <span v-if="voting && votingTargetId === o.id" class="pointer-events-none absolute inset-0 grid place-items-center bg-black/30"><span class="size-6 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" /></span>
          <span v-else-if="myVoteOptionId === o.id" class="pointer-events-none absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-[#b0761f] text-sm text-white" aria-hidden="true">✓</span>
          <button type="button" class="focus-ring absolute inset-0" :disabled="voting || isInteractionLocked" :aria-label="`選擇 ${o.label}`" @click="submitQuickVote(o.id)" />
          <button type="button" class="focus-ring absolute left-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70" :disabled="voting || isInteractionLocked" aria-label="放大檢視圖片" @click.stop="openLightbox(o.data?.imageUrl ?? '')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </button>
        </div>
      </div>
    </template>

    <template v-else-if="isVotingOpen && showResults && topic.topicType === 'SPECTRUM'">
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

    <template v-else-if="isVotingOpen && showResults && topic.topicType === 'SHORT_ANSWER'">
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
      <div class="mt-4 rounded-xl border border-[#e0c9a0] bg-[#fffaf0] p-4">
        <textarea v-model="shortAnswerText" maxlength="500" rows="3" placeholder="重新寫下你的回答…" class="block w-full resize-y rounded-xl border border-[#ded7cb] bg-white p-4 text-sm focus:border-[#3157d5] focus:outline-none" />
        <UiButton variant="quick" block class="mt-3" :disabled="voting || !shortAnswerText.trim()" @click="changeShortAnswer">{{ voting ? '更新中…' : '重新送出回答（更改票）' }}</UiButton>
      </div>
    </template>

    <template v-else-if="isVotingOpen && showResults && isOptionPick">
      <div class="space-y-2.5">
        <button
          v-for="o in visibleOptions"
          :key="o.id"
          type="button"
          class="focus-ring block w-full overflow-hidden rounded-xl border-2 text-left transition"
          :class="myVoteOptionId === o.id ? 'border-[#b0761f] bg-[#fff8ec]' : 'border-[#ded7cb] bg-white hover:border-[#b0761f]'"
          :disabled="voting"
          @click="changeQuickVote(o.id)"
        >
          <span class="flex items-center justify-between px-4 py-3 text-sm font-bold">
            <span class="flex items-center gap-2"><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}</span>
            <span class="flex items-center gap-2 tabular-nums">{{ optionPercentage(o, topic) }}% · {{ o.voteCount }} 票</span>
          </span>
          <span class="block h-1.5 bg-[#f0e6d2]"><span class="block h-full bg-[#b0761f] transition-[width] duration-500" :style="{ width: `${optionPercentage(o, topic)}%` }" /></span>
        </button>
      </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-3 w-full rounded-xl border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${topic.options.length}）` }}</button>
    </template>

    <template v-else-if="isVotingOpen && showResults && isImageOption">
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="o in topic.options"
          :key="o.id"
          class="focus-ring group relative overflow-hidden rounded-2xl border-2 text-left transition"
          :class="myVoteOptionId === o.id ? 'border-[#b0761f]' : 'border-[#ded7cb] hover:border-[#b0761f]'"
        >
          <span class="relative block aspect-square">
            <img :src="o.data?.imageUrl" :alt="o.label" class="absolute inset-0 h-full w-full object-cover" />
            <span class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8 text-xs font-black text-white">
              <span class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-1"><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}</span>
                <span class="shrink-0 tabular-nums">{{ optionPercentage(o, topic) }}% · {{ o.voteCount }} 票</span>
              </span>
            </span>
            <span class="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-white/20"><span class="block h-full bg-[#b0761f] transition-[width] duration-500" :style="{ width: `${optionPercentage(o, topic)}%` }" /></span>
            <button type="button" class="focus-ring absolute inset-0" :disabled="voting" :aria-label="`改投 ${o.label}`" @click="changeQuickVote(o.id)" />
            <button type="button" class="focus-ring absolute left-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70" :disabled="voting" aria-label="放大檢視圖片" @click.stop="openLightbox(o.data?.imageUrl ?? '')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            </button>
          </span>
        </div>
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
      <template v-else-if="isImageOption">
        <div class="grid grid-cols-2 gap-3">
          <div v-for="o in topic.options" :key="o.id" class="relative overflow-hidden rounded-2xl border border-[#ded7cb]">
            <span class="relative block aspect-square">
              <img :src="o.data?.imageUrl" :alt="o.label" class="absolute inset-0 h-full w-full object-cover" @click.stop="openLightbox(o.data?.imageUrl ?? '')" />
              <span class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8 text-xs font-black text-white">
                <span class="flex items-center justify-between gap-2">
                  <span>{{ o.label }}</span>
                  <span class="shrink-0 tabular-nums">{{ optionPercentage(o, topic) }}% · {{ o.voteCount }} 票</span>
                </span>
              </span>
              <span class="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-white/20"><span class="block h-full bg-[#3157d5]" :style="{ width: `${optionPercentage(o, topic)}%` }" /></span>
              <button type="button" class="focus-ring absolute left-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70" aria-label="放大檢視圖片" @click.stop="openLightbox(o.data?.imageUrl ?? '')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              </button>
            </span>
          </div>
        </div>
        <p v-if="topic.myVote" class="mt-5 rounded-xl border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-3 text-sm font-bold">你的選擇：{{ topic.myVote.choice }}</p>
      </template>
      <template v-else>
        <div class="space-y-5">
          <div v-for="o in visibleOptions" :key="o.id">
            <div class="mb-2 flex items-center justify-between gap-4 text-sm"><span class="font-bold">{{ o.label }}</span><span class="shrink-0 font-black tabular-nums">{{ optionPercentage(o, topic) }}% · {{ o.voteCount }} 票</span></div>
            <div class="h-2 rounded-full bg-[#dfdad0]"><div class="h-full rounded-full bg-[#3157d5] transition-[width] duration-500" :style="{ width: `${optionPercentage(o, topic)}%` }" /></div>
          </div>
        </div>
        <p v-if="topic.myVote" class="mt-5 rounded-xl border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-3 text-sm font-bold">你的選擇：{{ topic.myVote.choice }}</p>
        <button v-if="optionsCollapsed" type="button" class="focus-ring mt-4 w-full rounded-xl border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${topic.options.length}）` }}</button>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Topic, TopicOption } from '~/types/topic';
import { isImageOptionType, isOptionPickType, optionPercentage } from '~/utils/topic';
import { OPTION_COLLAPSE_LIMIT, VOTE_IDENTITY_NOTICE } from '~/utils/topic';

const props = defineProps<{ topic: Topic }>();
const emit = defineEmits<{ refreshed: [] }>();

const api = useApi();
const auth = useAuthStore();
const { success: toastSuccess, error: toastError } = useToast();

const lightboxSrc = ref<string | null>(null);
function openLightbox(src: string) { lightboxSrc.value = src; }

const isVotingOpen = computed(() => props.topic.status === 'OPEN' && !!props.topic.voteEndAt && new Date(props.topic.voteEndAt).getTime() > Date.now());
const participationReady = computed(() => !auth.isAuthed || Boolean(auth.capabilitySummary?.participation));
const showResults = computed(() => props.topic.hasVoted || !isVotingOpen.value || (auth.isAuthed && participationReady.value && !auth.canVote));
const isOptionPick = computed(() => isOptionPickType(props.topic.topicType));
const isImageOption = computed(() => isImageOptionType(props.topic.topicType));
const isInteractionLocked = computed(() => !auth.isAuthed);

const voting = ref(false);
const votingTargetId = ref<string | null>(null);
const spectrumValue = ref(50);
const shortAnswerText = ref('');
const myVoteOptionId = computed(() => props.topic.options.find((option) => option.label === props.topic.myVote?.choice)?.id ?? null);
const votedOptionId = computed(() => myVoteOptionId.value);
const votedChoice = computed(() => props.topic.myVote?.choice ?? '');
const votedOptionIndex = computed(() => props.topic.options.findIndex((option) => option.label === props.topic.myVote?.choice));
const hasVotedGame = computed(() => !!props.topic.hasVoted);
const redoMode = ref(false);
const mySpectrumValue = computed(() => {
  const value = props.topic.myVote?.spectrumValue;
  return value != null ? Number(value) : null;
});
const spectrumUnchanged = computed(() => mySpectrumValue.value !== null && spectrumValue.value === mySpectrumValue.value);

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
  const index = props.topic.options.findIndex((option) => option.id === lotteryDrawId.value) ?? -1;
  return index >= 0 ? index + 1 : '';
});
const lotteryStatusLabel = computed(() => {
  if (lotteryState.value === 'shaking') return '搖獎中…';
  if (lotteryState.value === 'drawing') return '開獎…';
  if (lotteryState.value === 'result') return '抽中了！搖中哪顆即投哪票';
  return '每顆球代表一個選項，搖中即送出';
});
const wheelHitIndex = ref<number | null>(null);
const wheelConfettiKey = ref('');
const lotteryConfettiKey = ref('');
const matchingPending = ref(false);
const matchedPair = ref<[string, string] | null>(null);
const matchingWrong = ref<string | null>(null);
const scratchDoneId = ref<string | null>(null);
const puzzleJustIndex = ref<{ optionId: string; index: number } | null>(null);
const puzzleWrongRow = ref<string | null>(null);
const puzzleDoneId = ref<string | null>(null);
const wheelColors = ['#b0761f', '#3157d5', '#3f7a58', '#9a6a12', '#7c3aed', '#c2410c', '#0e7490', '#be185d'];

const showAllOptions = ref(false);
const optionsCollapsed = computed(() => !showAllOptions.value && props.topic.options.length > OPTION_COLLAPSE_LIMIT);
const visibleOptions = computed(() => optionsCollapsed.value ? props.topic.options.slice(0, OPTION_COLLAPSE_LIMIT) : props.topic.options);
function toggleOptions() {
  showAllOptions.value = !showAllOptions.value;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shuffleArray(items: string[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function preparePuzzle() {
  for (const option of props.topic.options) {
    if (!puzzleShuffles[option.id]) puzzleShuffles[option.id] = shuffleArray([...option.label]);
  }
}

function polar(radius: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)];
}

function wheelArc(index: number): string {
  const count = props.topic.options.length;
  const size = 360 / Math.max(count, 1);
  const [x0, y0] = polar(98, index * size);
  const [x1, y1] = polar(98, index * size + size);
  return `M100 100 L${x0.toFixed(2)} ${y0.toFixed(2)} A98 98 0 ${size > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function wheelLabel(index: number) {
  const count = props.topic.options.length;
  const size = 360 / Math.max(count, 1);
  const mid = index * size + size / 2;
  const [x, y] = polar(62, mid);
  return { x, y, rotate: mid };
}

async function submitQuickVote(optionId: string) {
  if (voting.value || !auth.isAuthed || optionId === myVoteOptionId.value) return;
  voting.value = true;
  votingTargetId.value = optionId;
  try {
    const res = await api.post<{ newBalance: string; rewardPoints: number }>(`/topics/${props.topic.id}/vote`, { optionId });
    auth.updatePoints(res.newBalance);
    votingTargetId.value = null;
    toastSuccess('已投票，快問結果即時更新');
    emit('refreshed');
  } catch (e) {
    votingTargetId.value = null;
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}

async function changeQuickVote(optionId: string) {
  if (voting.value || optionId === myVoteOptionId.value) return;
  voting.value = true;
  votingTargetId.value = optionId;
  try {
    const res = await api.patch<{ newBalance: string; rewardPoints: number }>(`/topics/${props.topic.id}/vote`, { optionId });
    auth.updatePoints(res.newBalance);
    votingTargetId.value = null;
    emit('refreshed');
  } catch (e) {
    votingTargetId.value = null;
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}

async function submitLanded(option: TopicOption) {
  if (voting.value) return;
  if (option.id === myVoteOptionId.value) return;
  if (props.topic.hasVoted) await changeQuickVote(option.id);
  else await submitQuickVote(option.id);
}

async function submitShortAnswer() {
  const text = shortAnswerText.value.trim();
  if (voting.value || !text) return;
  voting.value = true;
  try {
    const res = await api.post<{ newBalance: string; rewardPoints: number }>(`/topics/${props.topic.id}/vote`, { answerText: text });
    auth.updatePoints(res.newBalance);
    toastSuccess(res.rewardPoints > 0 ? `已送出回答，獲得 ${res.rewardPoints} 點` : '已送出回答');
    emit('refreshed');
  } catch (e) {
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}

async function changeShortAnswer() {
  const text = shortAnswerText.value.trim();
  if (voting.value || !text) return;
  voting.value = true;
  try {
    const res = await api.patch<{ newBalance: string; rewardPoints: number }>(`/topics/${props.topic.id}/vote`, { answerText: text });
    auth.updatePoints(res.newBalance);
    toastSuccess('已更新回答');
    emit('refreshed');
  } catch (e) {
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}

async function changeSpectrumVote() {
  if (voting.value || mySpectrumValue.value === null) return;
  voting.value = true;
  try {
    const res = await api.patch<{ newBalance: string; rewardPoints: number }>(`/topics/${props.topic.id}/vote`, { spectrumValue: spectrumValue.value });
    auth.updatePoints(res.newBalance);
    emit('refreshed');
  } catch (e) {
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}

async function submitSpectrumVote() {
  if (voting.value) return;
  voting.value = true;
  try {
    const res = await api.post<{ newBalance: string; rewardPoints: number }>(`/topics/${props.topic.id}/vote`, { spectrumValue: spectrumValue.value });
    auth.updatePoints(res.newBalance);
    toastSuccess(`已投下 ${spectrumValue.value} 分`);
    emit('refreshed');
  } catch (e) {
    toastError(errorMessage(e));
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
      redoMode.value = false;
      const option = props.topic.options.find((item) => item.id === optionId);
      if (option) window.setTimeout(() => void submitLanded(option), 380);
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
  if (voting.value || matchingPending.value || isInteractionLocked.value || !!matchedPair.value) return;
  const leftId = matchingLeftId.value;
  if (!leftId || leftId === optionId) return;
  const left = props.topic.options.find((option) => option.id === leftId);
  const right = props.topic.options.find((option) => option.id === optionId);
  matchingLeftId.value = null;
  if (left && right && left.label === right.data?.match) {
    matchingPending.value = true;
    matchedPair.value = [leftId, optionId];
    window.setTimeout(() => {
      matchingPending.value = false;
      void submitLanded(right);
      if (props.topic.hasVoted) resetMatching();
    }, 340);
  } else {
    matchingWrong.value = optionId;
    toastError('配對錯誤，請再試一次');
    window.setTimeout(() => {
      matchingWrong.value = null;
    }, 720);
  }
}

function resetMatching() {
  matchedPair.value = null;
  matchingLeftId.value = null;
}

function resetScratch() {
  redoMode.value = true;
  scratchDoneId.value = null;
  for (const key of Object.keys(scratchProgress)) scratchProgress[key] = 0;
}

function onPuzzleTile(optionId: string, index: number, letter: string) {
  if (voting.value || isInteractionLocked.value || puzzleDoneId.value === optionId) return;
  const option = props.topic.options.find((item) => item.id === optionId);
  if (!option) return;
  const progress = puzzleProgress[optionId] ?? 0;
  if (letter === option.label[progress]) {
    puzzleProgress[optionId] = progress + 1;
    puzzleJustIndex.value = { optionId, index };
    window.setTimeout(() => {
      if (puzzleJustIndex.value?.optionId === optionId && puzzleJustIndex.value?.index === index) puzzleJustIndex.value = null;
    }, 320);
    if (puzzleProgress[optionId] >= option.label.length) {
      for (const key of Object.keys(puzzleProgress)) if (key !== optionId) delete puzzleProgress[key];
      puzzleDoneId.value = optionId;
      window.setTimeout(() => void submitLanded(option), 380);
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
  const options = props.topic.options;
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
  const options = props.topic.options;
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
      await submitLanded(option);
    }, 620);
  }, 2800);
}

function shakeLottery() {
  const options = props.topic.options;
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
        await submitLanded(option);
      }, 620);
    }, 520);
  }, 1080);
}

watch(() => props.topic.myVote?.spectrumValue, (value) => {
  if (value != null) spectrumValue.value = Number(value);
});
watch(() => props.topic.id, (nextId, previousId) => {
  if (nextId === previousId) return;
  redoMode.value = false;
  matchedPair.value = null;
  matchingLeftId.value = null;
  puzzleDoneId.value = null;
  scratchDoneId.value = null;
  lotteryState.value = 'idle';
  lotteryResultId.value = null;
  wheelHitIndex.value = null;
  for (const key of Object.keys(puzzleProgress)) delete puzzleProgress[key];
  for (const key of Object.keys(scratchProgress)) scratchProgress[key] = 0;
  preparePuzzle();
});

onMounted(() => {
  preparePuzzle();
});
onUnmounted(() => {
  scratchStop();
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