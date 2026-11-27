const MAX_CONTEXT_LENGTH = 1900;
const MAX_INITIAL_LENGTH = 900;
const MAX_REPLY_LENGTH = 450;
const MAX_REPLIES = 8;

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .toLowerCase();

export const isNewSymptomTopicRequest = (message) => {
  const text = normalizeText(message);
  return /\b(cau hoi khac|van de khac|bat dau (?:lai|van de moi)|hoi viec khac|doi chu de)\b/.test(text);
};

export const appendSymptomTurn = (conversation, message) => {
  const text = String(message || '').trim();
  if (!text) return conversation || null;

  if (!conversation?.initial) {
    return { initial: text.slice(0, MAX_INITIAL_LENGTH), details: [], pendingQuestions: [] };
  }

  return {
    initial: conversation.initial.slice(0, MAX_INITIAL_LENGTH),
    details: [
      ...(conversation.details || []),
      { questions: conversation.pendingQuestions || [], answer: text.slice(0, MAX_REPLY_LENGTH) }
    ].slice(-MAX_REPLIES),
    pendingQuestions: []
  };
};

export const buildSymptomContext = (conversation) => {
  if (!conversation?.initial) return '';
  const format = (state) => [
    `Mô tả ban đầu: ${state.initial}`,
    ...(state.details || []).flatMap((detail, index) => [
      ...(detail.questions?.length ? [`Câu hỏi làm rõ trước đó ${index + 1}: ${detail.questions.join(' | ')}`] : []),
      `Thông tin người dùng bổ sung ${index + 1}: ${detail.answer}`
    ])
  ].join('\n');

  let bounded = {
    initial: conversation.initial.slice(0, MAX_INITIAL_LENGTH),
    details: (conversation.details || []).slice(-MAX_REPLIES)
  };
  let context = format(bounded);
  while (context.length > MAX_CONTEXT_LENGTH && bounded.details.length) {
    bounded = { ...bounded, details: bounded.details.slice(1) };
    context = format(bounded);
  }
  return context.slice(0, MAX_CONTEXT_LENGTH);
};
