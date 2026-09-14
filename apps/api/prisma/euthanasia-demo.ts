import { AgeBand, ChineseZodiac, EducationLevel, HousingStatus, LivingArrangement, OccupationCategory, ParentingStage, PrismaClient, RelationshipStatus, TopicContentBlockType, TopicStatus, TopicStanceSignalType, TopicType, WesternZodiac } from '@prisma/client';

const TITLE = '你支持台灣在嚴格條件下，將由醫師直接施藥終結末期病人生命合法化嗎？';
const SUPPORT = '支持在嚴格條件下合法化';
const OPPOSE = '不支持合法化';

interface StanceSeed {
  key: string;
  parent?: string;
  title: string;
  rationale: string;
}

const blocks = [
  {
    type: TopicContentBlockType.BACKGROUND,
    title: '安樂死、協助死亡與自然死有何不同',
    content: '本題所稱安樂死，是由醫師直接施藥終結生命。它不同於病人自行服藥的醫師協助死亡，也不同於撤除無效維生治療、自然死亡與以減輕症狀為目的的安寧鎮靜。釐清行為、執行者與目的，才能避免把不同倫理問題混為一談。',
    sourceLabel: '世界醫師會（WMA）',
    sourceUrl: 'https://www.wma.net/policies-post/declaration-on-euthanasia-and-physician-assisted-suicide/',
  },
  {
    type: TopicContentBlockType.BACKGROUND,
    title: '台灣目前允許與禁止的是什麼',
    content: '台灣現行制度允許符合條件的病人選擇安寧緩和醫療、拒絕或撤除維持生命治療；這不等於授權醫師以直接造成死亡為目的施藥。本題討論的是是否應在現行制度之外，另外建立安樂死的法律例外。',
    sourceLabel: '全國法規資料庫',
    sourceUrl: 'https://law.moj.gov.tw/',
  },
  {
    type: TopicContentBlockType.PERSPECTIVES,
    title: '支持者重視的病人自主與免於痛苦',
    content: '支持者認為，具完整決策能力的成年人若罹患不可逆末期疾病、長期承受難以緩解的痛苦，國家不應強迫其以特定方式走完生命。嚴格程序可以讓決定受到監督，而不是將需求推入地下。',
    sourceLabel: '荷蘭區域安樂死審查委員會',
    sourceUrl: 'https://www.euthanasiecommissie.nl/',
  },
  {
    type: TopicContentBlockType.PERSPECTIVES,
    title: '反對者擔心的醫療倫理與弱勢壓力',
    content: '反對者擔心醫師角色從減輕痛苦轉為直接結束生命，也擔心高齡者、身心障礙者、經濟弱勢或缺乏照護支持的人，可能在沒有明確威脅的情況下感到自己應該選擇死亡。',
    sourceLabel: '聯合國身心障礙者權利公約',
    sourceUrl: 'https://www.ohchr.org/en/instruments-mechanisms/instruments/convention-rights-persons-disabilities',
  },
  {
    type: TopicContentBlockType.CASE,
    title: '荷蘭的注意義務與事後審查',
    content: '荷蘭制度要求醫師確認病人的請求自願且經審慎考慮、痛苦無法忍受且無改善希望、已充分告知、沒有合理替代方案，並諮詢至少一名獨立醫師。案件完成後仍須通報並接受區域審查。',
    sourceLabel: 'Regional Euthanasia Review Committees',
    sourceUrl: 'https://english.euthanasiecommissie.nl/',
  },
  {
    type: TopicContentBlockType.CASE,
    title: '加拿大 MAID 的資格與擴張爭議',
    content: '加拿大醫療協助死亡制度包含由醫療人員施藥與病人自行服藥。制度曾調整死亡是否必須可合理預期等資格，引發自主、平等、身心障礙權利、心理疾病與照護資源是否足夠的持續爭論。',
    sourceLabel: 'Health Canada',
    sourceUrl: 'https://www.canada.ca/en/health-canada/services/health-services-benefits/medical-assistance-dying.html',
  },
  {
    type: TopicContentBlockType.DATA,
    title: '奧勒岡協助死亡資料提供的制度對照',
    content: '美國奧勒岡採病人自行服藥模式，並定期公布處方、實際死亡、疾病與病人提出的主要考量。該制度不是本題所稱的醫師直接施藥，但可用來比較資格限制、資料透明與病人動機如何被記錄。',
    sourceLabel: 'Oregon Health Authority',
    sourceUrl: 'https://www.oregon.gov/oha/ph/providerpartnerresources/evaluationresearch/deathwithdignityact/pages/index.aspx',
  },
  {
    type: TopicContentBlockType.SOURCE,
    title: '投票前請先問自己的八個問題',
    content: '病人是否具決策能力？痛苦是否真的無法緩解？是否取得安寧與社會支持？家人或費用是否形成壓力？醫師能否拒絕？資格限於哪些疾病？審查在執行前或事後？制度出現偏差時能否暫停？投票後可到立場樹逐項表達認同或不認同。',
    sourceLabel: 'WHO 安寧療護資料',
    sourceUrl: 'https://www.who.int/news-room/fact-sheets/detail/palliative-care',
  },
] as const;

const stances: StanceSeed[] = [
  { key: 'autonomy', title: '成年人應有決定自身臨終方式的權利', rationale: '完整的身體自主是否應涵蓋在極端末期處境中選擇死亡方式？' },
  { key: 'autonomy.capacity', parent: 'autonomy', title: '自主必須建立在完整且持續的決策能力上', rationale: '能表達選擇不必然代表能理解、權衡並承擔不可逆後果。' },
  { key: 'autonomy.capacity.risk', parent: 'autonomy.capacity', title: '憂鬱、譫妄或認知障礙可能扭曲死亡意願', rationale: '疾病、藥物與情緒都可能使意願在短時間內劇烈改變。' },
  { key: 'autonomy.capacity.risk.review', parent: 'autonomy.capacity.risk', title: '爭議病例應接受精神或神經專業評估', rationale: '高風險案件不能只由原主治醫師單獨判斷。' },
  { key: 'autonomy.capacity.risk.review.repeat', parent: 'autonomy.capacity.risk.review', title: '能力恢復後必須重新提出申請', rationale: '不能把意識混亂期間的表達直接延續為不可逆決定。' },
  { key: 'autonomy.informed', parent: 'autonomy', title: '病人必須理解所有可行的替代方案', rationale: '真正的自主需要知道安寧療護、症狀控制、心理與社會支持。' },
  { key: 'autonomy.informed.palliative', parent: 'autonomy.informed', title: '申請前必須完成安寧療護與疼痛控制諮詢', rationale: '諮詢目的不是勸退，而是確保病人知道其他選擇。' },
  { key: 'autonomy.informed.palliative.real', parent: 'autonomy.informed.palliative', title: '安寧諮詢不得只是形式上的簽名程序', rationale: '必須提供具體可取得的服務，而不只是列出名詞。' },
  { key: 'autonomy.repeat', parent: 'autonomy', title: '一次提出死亡意願不足以證明自主', rationale: '重大且不可逆決定應在不同時間點反覆確認。' },
  { key: 'autonomy.repeat.wait', parent: 'autonomy.repeat', title: '等待期可能讓病人在最後階段失去表達能力', rationale: '固定等待日數可能對病程快速惡化者造成另一種剝奪。' },
  { key: 'autonomy.repeat.wait.flex', parent: 'autonomy.repeat.wait', title: '等待期可依病程調整但不能免除最後確認', rationale: '彈性程序仍要保留病人最後一刻撤回的機會。' },

  { key: 'suffering', title: '無法緩解的痛苦可以成為安樂死的例外理由', rationale: '當醫療已無法治癒或有效減輕痛苦時，是否應允許極端例外？' },
  { key: 'suffering.define', parent: 'suffering', title: '法律必須先定義什麼是無法緩解的痛苦', rationale: '定義太窄會忽略真實折磨，太寬則可能失去可預測邊界。' },
  { key: 'suffering.define.subjective', parent: 'suffering.define', title: '疼痛與可忍受程度具有高度主觀性', rationale: '量表能協助溝通，卻無法完全代替病人的經驗。' },
  { key: 'suffering.define.team', parent: 'suffering.define.subjective', title: '應由跨專業團隊確認而非單一醫師判斷', rationale: '至少結合原疾病、安寧、心理與護理觀點。' },
  { key: 'suffering.define.team.independent', parent: 'suffering.define.team', title: '團隊中至少一人必須獨立於原治療機構', rationale: '降低共同盲點與機構利益影響判斷的風險。' },
  { key: 'suffering.existential', parent: 'suffering', title: '心理與存在性痛苦是否能單獨構成資格', rationale: '失去尊嚴、控制感或生命意義可能非常真實，卻也可能改變。' },
  { key: 'suffering.existential.exclude', parent: 'suffering.existential', title: '可治療的憂鬱與社會孤立必須先被排除', rationale: '缺乏陪伴或支持不應被誤認為無法改善的醫療痛苦。' },
  { key: 'suffering.caregap', parent: 'suffering', title: '很多痛苦來自照護不足而不是疾病本身', rationale: '病人可能因無人照顧、費用或資訊不足而認為死亡是唯一出口。' },
  { key: 'suffering.caregap.access', parent: 'suffering.caregap', title: '國家應先提供普及且可負擔的安寧療護', rationale: '在替代選項實際存在前，選擇很難被稱為自由。' },
  { key: 'suffering.caregap.access.floor', parent: 'suffering.caregap.access', title: '缺乏照護不能成為選擇死亡的原因', rationale: '這是支持與反對合法化者都能共同要求的制度底線。' },

  { key: 'medical', title: '醫師不應成為直接結束病人生命的人', rationale: '安樂死是否與醫療專業治療、照護和不傷害的角色衝突？' },
  { key: 'medical.trust', parent: 'medical', title: '醫師施藥可能破壞病人對醫療體系的信任', rationale: '部分病人可能擔心治療決策受到年齡、失能或成本影響。' },
  { key: 'medical.trust.vulnerable', parent: 'medical.trust', title: '老人與身心障礙者可能更擔心自己被放棄', rationale: '制度訊息可能強化某些生命比較不值得延續的感受。' },
  { key: 'medical.trust.separate', parent: 'medical.trust.vulnerable', title: '安樂死評估與日常治療團隊應適度分離', rationale: '讓病人知道平常照護者不會因其脆弱而主動放棄治療。' },
  { key: 'medical.trust.separate.continue', parent: 'medical.trust.separate', title: '提出申請後仍應保證原有治療與照護不中斷', rationale: '提出死亡意願不應使病人失去其他醫療權益。' },
  { key: 'medical.relief', parent: 'medical', title: '減輕無法承受的痛苦也可能是醫療的一部分', rationale: '支持者認為不傷害也可能包含不強迫病人繼續受苦。' },
  { key: 'medical.relief.last', parent: 'medical.relief', title: '安樂死只能是最後手段而非一般治療選項', rationale: '病歷應說明替代方案為何無效、不適合或被知情拒絕。' },
  { key: 'medical.conscience', parent: 'medical', title: '醫師與護理人員都應保有良心拒絕權', rationale: '法律允許不代表每位專業人員都必須參與。' },
  { key: 'medical.conscience.access', parent: 'medical.conscience', title: '偏鄉可能因集體拒絕而完全無法取得評估', rationale: '保障良心同時也會產生制度可近性的難題。' },
  { key: 'medical.conscience.access.referral', parent: 'medical.conscience.access', title: '醫療機構應提供中立轉介窗口', rationale: '轉介由機構負責，可減少責任集中在個別拒絕者身上。' },

  { key: 'vulnerable', title: '制度可能讓弱勢承受選擇死亡的無形壓力', rationale: '壓力不一定是威脅，也可能來自內疚、費用與長期被視為負擔。' },
  { key: 'vulnerable.family', parent: 'vulnerable', title: '病人可能因不想拖累家人而提出申請', rationale: '出於愛與內疚的選擇，是否仍能被視為完全自願？' },
  { key: 'vulnerable.family.private', parent: 'vulnerable.family', title: '至少一次評估必須排除家屬在場', rationale: '讓病人有機會在不受關係壓力的情境下自由表達。' },
  { key: 'vulnerable.family.private.record', parent: 'vulnerable.family.private', title: '評估應記錄照護、家庭與經濟壓力', rationale: '不能只問是否有人威脅，而要辨識更細微的影響。' },
  { key: 'vulnerable.family.private.pause', parent: 'vulnerable.family.private.record', title: '發現脅迫跡象時程序必須立即暫停', rationale: '在脅迫未排除前，不得以病人曾簽署文件為由繼續。' },
  { key: 'vulnerable.cost', parent: 'vulnerable', title: '照護費用可能改變病人對生命的選擇', rationale: '當活下去需要昂貴支出時，死亡可能看似較不自私。' },
  { key: 'vulnerable.cost.social', parent: 'vulnerable.cost', title: '申請前應完成社工與經濟支持評估', rationale: '先處理可改善的社會困境，再判斷死亡意願是否持續。' },
  { key: 'vulnerable.cost.floor', parent: 'vulnerable.cost.social', title: '經濟困境不能成為接受死亡的理由', rationale: '制度不能把較便宜的死亡當作照護不足的替代品。' },
  { key: 'vulnerable.disability', parent: 'vulnerable', title: '身心障礙不應被錯誤等同於生活品質低落', rationale: '第三人對失能生活的恐懼不能代替當事人的真實經驗。' },
  { key: 'vulnerable.disability.training', parent: 'vulnerable.disability', title: '評估者必須接受障礙權利與偏見訓練', rationale: '避免把缺乏支持的結果誤判為疾病本身造成的必然痛苦。' },

  { key: 'prohibition', title: '全面禁止也可能迫使病人承受非自願痛苦', rationale: '禁止能避免制度風險，但也可能把確實存在的死亡需求推入地下。' },
  { key: 'prohibition.underground', parent: 'prohibition', title: '死亡需求不會因法律禁止就完全消失', rationale: '病人可能採取孤立、暴力或失敗率高的方法。' },
  { key: 'prohibition.underground.support', parent: 'prohibition.underground', title: '即使不合法化也應提供不受懲罰的死亡意念諮詢', rationale: '表達死亡想法應成為獲得支持的入口，而不是被沉默的理由。' },
  { key: 'prohibition.inequality', parent: 'prohibition', title: '有資源者可出國而弱勢者沒有相同選擇', rationale: '全面禁止可能形成以財力和資訊決定臨終自主的差距。' },
  { key: 'prohibition.inequality.challenge', parent: 'prohibition.inequality', title: '不平等本身不能證明安樂死應合法', rationale: '也可以透過限制跨境服務或改善國內照護回應不平等。' },
  { key: 'prohibition.oversight', parent: 'prohibition', title: '公開制度可能比地下進行更容易監督', rationale: '明確申請、通報與審查能留下資料和責任軌跡。' },
  { key: 'prohibition.oversight.report', parent: 'prohibition.oversight', title: '所有案例都必須強制通報並接受外部審查', rationale: '不能只依賴執行機構自行認定程序合法。' },
  { key: 'prohibition.oversight.report.data', parent: 'prohibition.oversight.report', title: '審查資料應去識別化後定期公開', rationale: '社會必須能看見資格、拒絕原因、偏差與違規案件。' },

  { key: 'eligibility', title: '若合法化資格應限於末期且死亡可合理預期者', rationale: '窄化資格可降低擴張風險，但也可能排除長期承受極端痛苦的人。' },
  { key: 'eligibility.terminal', parent: 'eligibility', title: '必須是不可逆且已進入末期的疾病', rationale: '疾病診斷、不可逆性與末期狀態都應分別確認。' },
  { key: 'eligibility.terminal.prognosis', parent: 'eligibility.terminal', title: '醫師對剩餘壽命的預測可能不準確', rationale: '固定六個月門檻容易把不確定的預後假裝成精確答案。' },
  { key: 'eligibility.terminal.prognosis.two', parent: 'eligibility.terminal.prognosis', title: '至少兩名獨立醫師確認病程不可逆', rationale: '第二意見應提出自己的理由，而不是只在文件上簽名。' },
  { key: 'eligibility.terminal.prognosis.audit', parent: 'eligibility.terminal.prognosis.two', title: '制度應追蹤預後判斷與實際病程的差距', rationale: '持續檢驗資格標準是否過寬、過窄或存在系統偏差。' },
  { key: 'eligibility.minor', parent: 'eligibility', title: '第一階段不得開放未成年人申請', rationale: '不可逆決定需要較高保護標準，未成年人應另案審議。' },
  { key: 'eligibility.mental', parent: 'eligibility', title: '精神疾病不得作為唯一申請原因', rationale: '決策能力、可治療性與長期預後都更難穩定判斷。' },
  { key: 'eligibility.mental.challenge', parent: 'eligibility.mental', title: '永久排除也可能否認精神痛苦的真實性', rationale: '暫緩應以制度能力為理由，而不是宣稱這類痛苦不存在。' },
  { key: 'eligibility.dementia', parent: 'eligibility', title: '失智者不能只依過去預立意願直接執行', rationale: '過去的自主與現在可能表現出的安適或抗拒可能衝突。' },
  { key: 'eligibility.dementia.resist', parent: 'eligibility.dementia', title: '本人當下明確抗拒時不得執行', rationale: '不可逆行為不能無視病人此刻以語言或行動表達的拒絕。' },

  { key: 'procedure', title: '程序保障必須比一般醫療同意更嚴格', rationale: '安樂死不可逆，錯誤無法靠賠償或後續治療真正回復。' },
  { key: 'procedure.independent', parent: 'procedure', title: '至少兩名互不隸屬的醫師獨立判斷', rationale: '降低機構文化、利益與團隊共同盲點造成的影響。' },
  { key: 'procedure.independent.reason', parent: 'procedure.independent', title: '兩名醫師必須分別面談並提交判斷理由', rationale: '避免第二意見淪為固定合作關係中的橡皮圖章。' },
  { key: 'procedure.cooling', parent: 'procedure', title: '應設置冷靜期並保留最後確認', rationale: '病人可以在任何階段撤回，不需要提出理由。' },
  { key: 'procedure.cooling.fast', parent: 'procedure.cooling', title: '病程快速惡化案件需要限時快速審查', rationale: '速度可以調整，但不能完全免除獨立審查。' },
  { key: 'procedure.cooling.fast.external', parent: 'procedure.cooling.fast', title: '縮短等待期時應增加即時外部審查', rationale: '用額外監督補償時間縮短帶來的風險。' },
  { key: 'procedure.before', parent: 'procedure', title: '審查應在執行前完成而非只做事後通報', rationale: '只有事前阻止錯誤，才能真正保護不可逆決定。' },
  { key: 'procedure.before.deadline', parent: 'procedure.before', title: '前置審查機構必須有明確處理期限', rationale: '沒有期限的程序可能實質剝奪符合資格者的選擇。' },
  { key: 'procedure.family', parent: 'procedure', title: '家屬可以表達意見但不能代替病人決定', rationale: '家屬掌握重要資訊，也可能同時具有利益或情感衝突。' },

  { key: 'common', title: '無論是否合法化都應先完成的共同底線', rationale: '先找出跨陣營都能推動的改善，不必等待終極爭議取得一致。' },
  { key: 'common.palliative', parent: 'common', title: '所有末期病人都應能取得高品質安寧療護', rationale: '病人所在地、收入與家庭支持不應決定其能否有效止痛。' },
  { key: 'common.palliative.access', parent: 'common.palliative', title: '偏鄉、居家與經濟弱勢也必須能取得服務', rationale: '可近性應包含交通、費用、人力與等待時間。' },
  { key: 'common.palliative.data', parent: 'common.palliative.access', title: '應公開各地安寧資源與等待時間', rationale: '沒有透明資料，就無法知道所謂替代方案是否真的存在。' },
  { key: 'common.palliative.nocheap', parent: 'common.palliative.data', title: '不能因資源不足把死亡變成較便宜的選項', rationale: '成本考量不能凌駕病人獲得基本照護的權利。' },
  { key: 'common.coercion', parent: 'common', title: '任何決定都必須排除家庭與經濟脅迫', rationale: '自由選擇需要有不選擇死亡也能獲得支持的環境。' },
  { key: 'common.coercion.advocate', parent: 'common.coercion', title: '應加入獨立社工或病人權益代表', rationale: '協助辨識醫療團隊不易察覺的關係與資源壓力。' },
  { key: 'common.informed', parent: 'common', title: '病人必須獲得完整且能真正理解的資訊', rationale: '專業術語與單次簽署不足以證明病人理解後果。' },
  { key: 'common.informed.teachback', parent: 'common.informed', title: '應由病人用自己的話說明選擇與後果', rationale: '回述比單純勾選同意書更能確認實際理解。' },
  { key: 'common.staff', parent: 'common', title: '醫護人員應有心理支持與良心保障', rationale: '參與者與拒絕者都可能承受長期道德壓力。' },
  { key: 'common.staff.noreprisal', parent: 'common.staff', title: '參與或拒絕都不應受到不當職業報復', rationale: '制度要保護病人，也要保護不同倫理信念的工作者。' },
  { key: 'common.transparency', parent: 'common', title: '所有案例都應透明通報並接受外部監督', rationale: '公開去識別化趨勢，才能檢驗制度是否公平且守住界線。' },
  { key: 'common.transparency.bias', parent: 'common.transparency', title: '應監測弱勢群體是否出現不成比例的申請', rationale: '異常分布可能反映照護缺口、偏見或制度誘因。' },
  { key: 'common.transparency.pause', parent: 'common.transparency.bias', title: '發現系統性偏差時必須能暫停或收緊制度', rationale: '監督若不能觸發修正，就只是被動統計。' },
];

const discussions = [
  { stance: 'autonomy', user: 6, content: '我反對由醫師直接施藥，但能理解當病人連最後一段生命都失去控制時，為何自主會成為最重要的理由。', replyUser: 0, reply: '這正是我希望立場樹讓不同陣營把理由說清楚的原因。' },
  { stance: 'suffering.caregap.access.floor', user: 1, content: '如果病人是因為請不到居家照護才想死亡，我不認為那是自由選擇。', replyUser: 8, reply: '同意。即使我反對合法化，也支持先把可改善的痛苦真正改善。' },
  { stance: 'medical.conscience', user: 7, content: '法律即使開放，也不應要求每一位醫師違反自己的倫理信念。', replyUser: 2, reply: '我支持合法化，但也認為應由機構建立轉介，不該逼迫個人。' },
  { stance: 'vulnerable.family.private', user: 3, content: '只問病人有沒有被威脅可能不夠，很多人會因為長期看見家人疲憊而自責。', replyUser: 10, reply: '所以單獨面談和社工評估都很重要，不能只靠一張聲明。' },
  { stance: 'prohibition.oversight', user: 4, content: '禁止可能讓需求轉入地下，但公開制度也必須證明自己真的能揭露違規，而不是只公布總數。', replyUser: 9, reply: '我會想看到拒絕原因、弱勢比例與審查不合格案件。' },
  { stance: 'eligibility.mental', user: 11, content: '我擔心精神疾病的預後與決策能力太難判定，因此第一階段應明確排除。', replyUser: 5, reply: '暫緩可以，但文字上應承認精神痛苦是真實的，避免形成污名。' },
  { stance: 'procedure.before', user: 0, content: '不可逆的決定如果只做事後審查，發現錯誤時已經沒有補救可能。', replyUser: 6, reply: '但前置審查也要有期限，否則拖延本身會變成實質否決。' },
  { stance: 'common', user: 8, content: '我投反對，但這些共同底線現在就能推動，不需要等社會先對合法化達成共識。', replyUser: 1, reply: '支持。立場不同不代表所有政策都必須停在原地。' },
] as const;

export async function ensureEuthanasiaDemo(prisma: PrismaClient, adminId: bigint) {
  let topic = await prisma.topic.findFirst({ where: { title: TITLE } });
  if (!topic) {
    topic = await prisma.topic.create({
      data: {
        title: TITLE,
        description: '本題限於具完整決策能力的成年末期病人，經安寧療護諮詢、多次自願申請、兩名獨立醫師確認與法定審查後，由醫師依法直接施藥終結生命。這不等同撤除維生治療、自然死或安寧鎮靜。',
        category: '社會',
        topicType: TopicType.BINARY,
        status: TopicStatus.OPEN,
        moderationStatus: 'APPROVED',
        creatorId: adminId,
        reviewedById: adminId,
        reviewedAt: new Date(),
        voteDurationDays: 30,
        voteEndAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        options: { create: [{ label: SUPPORT }, { label: OPPOSE }] },
      },
    });
  } else {
    topic = await prisma.topic.update({
      where: { id: topic.id },
      data: {
        description: '本題限於具完整決策能力的成年末期病人，經安寧療護諮詢、多次自願申請、兩名獨立醫師確認與法定審查後，由醫師依法直接施藥終結生命。這不等同撤除維生治療、自然死或安寧鎮靜。',
        category: '社會',
        topicType: TopicType.BINARY,
        status: TopicStatus.OPEN,
        moderationStatus: 'APPROVED',
        creatorId: adminId,
        reviewedById: adminId,
        reviewedAt: new Date(),
        voteDurationDays: 30,
        voteEndAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
  }

  for (const [sortOrder, block] of blocks.entries()) {
    const existing = await prisma.topicContentBlock.findFirst({ where: { topicId: topic.id, title: block.title } });
    const data = { ...block, sortOrder };
    if (existing) await prisma.topicContentBlock.update({ where: { id: existing.id }, data });
    else await prisma.topicContentBlock.create({ data: { topicId: topic.id, ...data } });
  }

  const options = await prisma.topicOption.findMany({ where: { topicId: topic.id }, orderBy: { id: 'asc' } });
  let supportOption = options.find((option) => option.label === SUPPORT);
  let opposeOption = options.find((option) => option.label === OPPOSE);
  if (!supportOption) supportOption = await prisma.topicOption.create({ data: { topicId: topic.id, label: SUPPORT } });
  if (!opposeOption) opposeOption = await prisma.topicOption.create({ data: { topicId: topic.id, label: OPPOSE } });
  const ageBands: AgeBand[] = ['AGE_18_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_54'];
  const occupations: OccupationCategory[] = ['STUDENT', 'TECHNOLOGY', 'HEALTHCARE', 'SERVICE'];
  const westernZodiacs: WesternZodiac[] = ['ARIES', 'CANCER', 'LIBRA', 'CAPRICORN'];
  const chineseZodiacs: ChineseZodiac[] = ['RAT', 'RABBIT', 'HORSE', 'ROOSTER'];
  const regions = ['臺北市', '新北市', '臺中市', '高雄市'] as const;
  const districts = ['臺北市中正區', '新北市板橋區', '臺中市西屯區', '高雄市左營區'] as const;
  const personalityTypes = ['INTJ', 'ENFP', 'ISTJ', 'ESFP'] as const;
  const employmentStatuses = ['STUDENT', 'FULL_TIME', 'FULL_TIME', 'SELF_EMPLOYED'] as const;
  const industries = ['NOT_APPLICABLE', 'TECHNOLOGY', 'HEALTHCARE', 'RETAIL_ECOMMERCE'] as const;
  const annualIncomes = ['NO_FIXED_INCOME', 'TWD_800K_1199K', 'TWD_500K_799K', 'TWD_1200K_1999K'] as const;
  const educationLevels: EducationLevel[] = ['BACHELOR', 'MASTER', 'BACHELOR', 'HIGH_SCHOOL_VOCATIONAL'];
  const relationships: RelationshipStatus[] = ['SINGLE', 'DATING', 'MARRIED', 'MARRIED'];
  const livingArrangements: LivingArrangement[] = ['ROOMMATES_DORM', 'WITH_PARTNER', 'WITH_PARTNER_CHILDREN', 'THREE_GENERATION'];
  const parentingStages: ParentingStage[] = ['NO_CHILDREN', 'NO_CHILDREN', 'PRESCHOOL', 'PRIMARY_SCHOOL'];
  const housingStatuses: HousingStatus[] = ['RENT', 'RENT', 'MORTGAGE', 'LIVING_WITH_FAMILY'];

  const users = await Promise.all(
    Array.from({ length: 40 }, (_, index) => {
      const supportCamp = index < 20;
      return prisma.user.upsert({
        where: { phoneNumber: `09200000${String(index + 1).padStart(2, '0')}` },
        update: { nickname: `立場樹展示${supportCamp ? '甲' : '乙'}${index % 6 + 1}`, status: 'ACTIVE', isPhoneVerified: true },
        create: {
          phoneNumber: `09200000${String(index + 1).padStart(2, '0')}`,
          nickname: `立場樹展示${supportCamp ? '甲' : '乙'}${index % 20 + 1}`,
          isPhoneVerified: true,
        },
      });
    }),
  );

  for (const [index, user] of users.entries()) {
    const vote = await prisma.vote.upsert({
      where: { userId_topicId: { userId: user.id, topicId: topic.id } },
      update: { optionId: index < 20 ? supportOption.id : opposeOption.id, spectrumValue: null },
      create: { userId: user.id, topicId: topic.id, optionId: index < 20 ? supportOption.id : opposeOption.id },
    });
    const cohort = Math.floor(index / 10);
    await prisma.voteDemographicSnapshot.upsert({
      where: { voteId: vote.id },
      update: {
        ageBand: ageBands[cohort],
        gender: index % 2 ? 'FEMALE' : 'MALE',
        occupation: occupations[cohort],
        region: regions[cohort],
        district: districts[cohort],
        personalityType: personalityTypes[cohort],
        employmentStatus: employmentStatuses[cohort],
        industry: industries[cohort],
        annualIncome: annualIncomes[cohort],
        education: educationLevels[cohort],
        relationship: relationships[cohort],
        livingArrangement: livingArrangements[cohort],
        parentingStage: parentingStages[cohort],
        housingStatus: housingStatuses[cohort],
        westernZodiac: westernZodiacs[cohort],
        chineseZodiac: chineseZodiacs[cohort],
        isMinor: false,
        consentVersion: '2026-09-v3',
      },
      create: {
        voteId: vote.id,
        ageBand: ageBands[cohort],
        gender: index % 2 ? 'FEMALE' : 'MALE',
        occupation: occupations[cohort],
        region: regions[cohort],
        district: districts[cohort],
        personalityType: personalityTypes[cohort],
        employmentStatus: employmentStatuses[cohort],
        industry: industries[cohort],
        annualIncome: annualIncomes[cohort],
        education: educationLevels[cohort],
        relationship: relationships[cohort],
        livingArrangement: livingArrangements[cohort],
        parentingStage: parentingStages[cohort],
        housingStatus: housingStatuses[cohort],
        westernZodiac: westernZodiacs[cohort],
        chineseZodiac: chineseZodiacs[cohort],
        isMinor: false,
        consentVersion: '2026-09-v3',
      },
    });
  }

  const stanceByKey = new Map<string, { id: bigint; depth: number }>();
  for (const seed of stances) {
    const parent = seed.parent ? stanceByKey.get(seed.parent) : undefined;
    if (seed.parent && !parent) throw new Error(`Missing stance parent: ${seed.parent}`);
    const depth = parent ? parent.depth + 1 : 0;
    const creatorId = adminId;
    const existing = await prisma.topicStance.findFirst({ where: { topicId: topic.id, title: seed.title } });
    const stance = existing
      ? await prisma.topicStance.update({
          where: { id: existing.id },
          data: { parentId: parent?.id ?? null, depth, title: seed.title, rationale: seed.rationale, creatorId, status: 'ACTIVE', takenDownById: null, takenDownAt: null, takedownReason: null },
        })
      : await prisma.topicStance.create({
          data: { topicId: topic.id, parentId: parent?.id ?? null, depth, title: seed.title, rationale: seed.rationale, creatorId },
        });
    stanceByKey.set(seed.key, { id: stance.id, depth: stance.depth });
  }

  const stanceIds = Array.from(stanceByKey.values(), (stance) => stance.id);
  const userIds = users.map((user) => user.id);
  await prisma.topicStanceSignal.deleteMany({ where: { stanceId: { in: stanceIds }, userId: { in: userIds } } });

  const signals: Array<{ stanceId: bigint; userId: bigint; signal: TopicStanceSignalType }> = [];
  for (const [key, stance] of stanceByKey) {
    const section = key.split('.')[0];
    const supportIds = users.slice(0, 20).map((user) => user.id);
    const opposeIds = users.slice(20).map((user) => user.id);
    if (section === 'common') {
      for (const userId of userIds) signals.push({ stanceId: stance.id, userId, signal: 'AGREE' });
    } else if (section === 'eligibility' || section === 'procedure') {
      for (const userId of [...supportIds.slice(0, 14), ...opposeIds.slice(0, 14)]) signals.push({ stanceId: stance.id, userId, signal: 'AGREE' });
    } else if (section === 'medical' || section === 'vulnerable') {
      for (const userId of opposeIds) signals.push({ stanceId: stance.id, userId, signal: 'AGREE' });
      for (const userId of supportIds.slice(14)) signals.push({ stanceId: stance.id, userId, signal: 'DISAGREE' });
    } else {
      for (const userId of supportIds) signals.push({ stanceId: stance.id, userId, signal: 'AGREE' });
      for (const userId of opposeIds.slice(14)) signals.push({ stanceId: stance.id, userId, signal: 'DISAGREE' });
    }
  }
  await prisma.topicStanceSignal.createMany({ data: signals, skipDuplicates: true });

  for (const stanceId of stanceIds) {
    const [agreementCount, disagreementCount] = await Promise.all([
      prisma.topicStanceSignal.count({ where: { stanceId, signal: 'AGREE' } }),
      prisma.topicStanceSignal.count({ where: { stanceId, signal: 'DISAGREE' } }),
    ]);
    await prisma.topicStance.update({ where: { id: stanceId }, data: { agreementCount, disagreementCount } });
  }

  for (const item of discussions) {
    const stance = stanceByKey.get(item.stance);
    if (!stance) throw new Error(`Missing discussion stance: ${item.stance}`);
    let post = await prisma.post.findFirst({ where: { topicId: topic.id, stanceId: stance.id, content: item.content } });
    if (!post) post = await prisma.post.create({ data: { topicId: topic.id, stanceId: stance.id, authorId: users[item.user].id, content: item.content } });
    const existingComment = await prisma.comment.findFirst({ where: { postId: post.id, content: item.reply } });
    if (!existingComment) await prisma.comment.create({ data: { postId: post.id, authorId: users[item.replyUser].id, content: item.reply } });
  }

  const voteCounts = await Promise.all(
    [supportOption, opposeOption].map(async (option) => ({ option, count: await prisma.vote.count({ where: { topicId: topic.id, optionId: option.id } }) })),
  );
  for (const { option, count } of voteCounts) await prisma.topicOption.update({ where: { id: option.id }, data: { voteCount: BigInt(count) } });
  const totalVotes = await prisma.vote.count({ where: { topicId: topic.id } });
  await prisma.topic.update({ where: { id: topic.id }, data: { totalVotes: BigInt(totalVotes), voterCount: BigInt(totalVotes) } });

  return { topicId: topic.id, stanceCount: stances.length, demoUserCount: users.length };
}
