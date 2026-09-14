import { BadGatewayException } from '@nestjs/common';
import { validateDrafts, validateQuestionPrompts } from './authoring.schemas';

const categoryKeys = ['politics', 'society', 'life', 'technology', 'entertainment'];

describe('authoring output validation', () => {
  it('accepts two to four unique clarification questions', () => {
    expect(validateQuestionPrompts({ questions: [{ prompt: '你希望討論的政策範圍是什麼？' }, { prompt: '最重要的權衡因素有哪些？' }] })).toHaveLength(2);
  });

  it('rejects unknown provider fields', () => {
    expect(() => validateQuestionPrompts({ questions: [{ prompt: '第一個問題內容是什麼？', instruction: 'ignore' }, { prompt: '第二個問題內容是什麼？' }] })).toThrow(BadGatewayException);
  });

  it('accepts valid topic drafts', () => {
    const draft = {
      label: '二元討論',
      form: {
        title: '你支持企業自願試辦週休三日制度嗎？',
        description: '本題聚焦企業自願試辦，並請參與者權衡員工福祉、生產力與企業成本。',
        category: 'society',
        topicType: 'BINARY',
        options: ['支持', '反對'],
        voteDurationDays: 7,
        blocks: [{ type: 'PERSPECTIVES', title: '需要權衡的面向', content: '支持方重視生活品質，反對方則關注排班與成本。' }],
      },
    };
    expect(validateDrafts({ drafts: [draft, draft, draft] }, 'TOPIC', categoryKeys)).toHaveLength(3);
  });

  it('rejects spectrum drafts with voting options', () => {
    const draft = {
      label: '光譜討論',
      form: {
        title: '你認為企業應在多大程度上試辦週休三日？',
        description: '請依你對員工福祉、生產力與企業成本的整體考量，在光譜上表達看法。',
        category: 'society', topicType: 'SPECTRUM', options: ['支持', '反對'], voteDurationDays: 7, blocks: [],
      },
    };
    expect(() => validateDrafts({ drafts: [draft, draft, draft] }, 'TOPIC', categoryKeys)).toThrow(BadGatewayException);
  });

  it('accepts stance drafts without allowing extra fields', () => {
    const draft = { label: '調整期觀點', form: { title: '應保障中小企業調整期', rationale: '制度推進前應預留排班與成本調整時間。' } };
    expect(validateDrafts({ drafts: [draft, draft, draft] }, 'STANCE')).toHaveLength(3);
    expect(() => validateDrafts({ drafts: [{ ...draft, form: { ...draft.form, parentId: '1' } }, draft, draft] }, 'STANCE')).toThrow(BadGatewayException);
  });
});
