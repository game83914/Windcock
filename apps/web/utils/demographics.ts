import type { DemographicDimension } from '~/types/profile';

export const demographicDimensionGroups: Array<{ label: string; items: Array<{ value: DemographicDimension; label: string }> }> = [
  { label: '基本輪廓', items: [{ value: 'AGE_BAND', label: '年齡' }, { value: 'GENDER', label: '性別' }, { value: 'REGION', label: '縣市' }, { value: 'DISTRICT', label: '行政區' }, { value: 'EDUCATION', label: '學歷' }] },
  { label: '工作與收入', items: [{ value: 'EMPLOYMENT_STATUS', label: '就業狀態' }, { value: 'INDUSTRY', label: '產業' }, { value: 'ANNUAL_INCOME', label: '年收入' }, { value: 'OCCUPATION', label: '舊職業分類' }] },
  { label: '生活狀態', items: [{ value: 'RELATIONSHIP', label: '感情／婚姻' }, { value: 'LIVING_ARRANGEMENT', label: '同住型態' }, { value: 'PARENTING_STAGE', label: '育兒階段' }, { value: 'HOUSING_STATUS', label: '住宅狀態' }] },
  { label: '自陳與趣味', items: [{ value: 'PERSONALITY_TYPE', label: '16 型人格' }, { value: 'WESTERN_ZODIAC', label: '星座' }, { value: 'CHINESE_ZODIAC', label: '生肖' }] },
];

export const demographicLabels: Record<string, string> = {
  UNDER_18: '未滿 18 歲', AGE_18_24: '18–24 歲', AGE_25_34: '25–34 歲', AGE_35_44: '35–44 歲', AGE_45_54: '45–54 歲', AGE_55_64: '55–64 歲', AGE_65_PLUS: '65 歲以上',
  FEMALE: '女性', MALE: '男性', NON_BINARY: '非二元', OTHER: '其他', PREFER_NOT_TO_SAY: '不願透露',
  STUDENT: '學生', PUBLIC_SERVICE: '軍公教', HEALTHCARE: '醫療', TECHNOLOGY: '科技', FINANCE: '金融保險', MANUFACTURING: '製造', SERVICE: '服務業', AGRICULTURE: '農林漁牧', CULTURE_MEDIA: '文化／媒體', FREELANCE: '自由工作', HOMEMAKER: '家務', UNEMPLOYED: '待業', RETIRED: '退休',
  FULL_TIME: '全職受僱', PART_TIME: '兼職受僱', SELF_EMPLOYED: '自營／自由工作', EMPLOYER: '雇主', HOMEMAKER_CAREGIVER: '家務／照顧者',
  PUBLIC_ADMINISTRATION: '公共行政', EDUCATION: '教育', RETAIL_ECOMMERCE: '零售／電商', HOSPITALITY_TOURISM: '餐旅／觀光', CONSTRUCTION_REAL_ESTATE: '營建／不動產', TRANSPORT_LOGISTICS: '運輸／物流', PROFESSIONAL_SERVICES: '專業服務', NONPROFIT: '非營利組織', NOT_APPLICABLE: '不適用',
  UNDER_300K: '未滿 30 萬', TWD_300K_499K: '30–未滿 50 萬', TWD_500K_799K: '50–未滿 80 萬', TWD_800K_1199K: '80–未滿 120 萬', TWD_1200K_1999K: '120–未滿 200 萬', TWD_2000K_PLUS: '200 萬以上', NO_FIXED_INCOME: '無固定收入',
  MIDDLE_SCHOOL_OR_BELOW: '國中以下', HIGH_SCHOOL_VOCATIONAL: '高中職', ASSOCIATE: '專科', BACHELOR: '大學', MASTER: '碩士', DOCTORATE: '博士',
  SINGLE: '單身', DATING: '交往／伴侶關係', MARRIED: '已婚', SEPARATED_DIVORCED: '分居／離婚', WIDOWED: '喪偶',
  ALONE: '獨居', WITH_PARTNER: '與伴侶同住', WITH_PARENTS_RELATIVES: '與父母／親屬同住', WITH_PARTNER_CHILDREN: '與伴侶及子女同住', SINGLE_PARENT_CHILDREN: '單親與子女同住', THREE_GENERATION: '三代同住', ROOMMATES_DORM: '室友／宿舍',
  NO_CHILDREN: '無子女', EXPECTING: '準備迎接子女', PRESCHOOL: '學齡前', PRIMARY_SCHOOL: '國小階段', SECONDARY_SCHOOL: '中學階段', ADULT_CHILDREN: '成年子女',
  OWN_OUTRIGHT: '自有且無房貸', MORTGAGE: '自有且繳房貸', RENT: '租屋', SOCIAL_HOUSING: '社會住宅', DORMITORY: '宿舍', LIVING_WITH_FAMILY: '居住家人住宅',
  ARIES: '牡羊座', TAURUS: '金牛座', GEMINI: '雙子座', CANCER: '巨蟹座', LEO: '獅子座', VIRGO: '處女座', LIBRA: '天秤座', SCORPIO: '天蠍座', SAGITTARIUS: '射手座', CAPRICORN: '摩羯座', AQUARIUS: '水瓶座', PISCES: '雙魚座',
  RAT: '鼠', OX: '牛', TIGER: '虎', RABBIT: '兔', DRAGON: '龍', SNAKE: '蛇', HORSE: '馬', GOAT: '羊', MONKEY: '猴', ROOSTER: '雞', DOG: '狗', PIG: '豬',
};
