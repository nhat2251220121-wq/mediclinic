export const isSymptomBookingAllowed = (result) => Boolean(
  result?.booking_allowed
  && (!result?.assessment_status || result.assessment_status === 'ASSESSED')
  && ['ROUTINE', 'URGENT'].includes(result?.urgency_level)
  && result?.specialty_id !== null
  && result?.specialty_id !== undefined
  && Number.isInteger(result?.specialty_id)
  && typeof result?.predicted_specialty === 'string'
  && result.predicted_specialty.trim()
);

const VALID_URGENCY_LEVELS = new Set(['ROUTINE', 'URGENT', 'EMERGENCY']);
const VALID_ASSESSMENT_STATUSES = new Set(['NEEDS_INFORMATION', 'CLARIFY', 'ASSESSED', 'EMERGENCY']);

export const getSymptomAssessmentStatus = (result) => {
  if (result?.urgency_level === 'EMERGENCY') return 'EMERGENCY';
  if (VALID_ASSESSMENT_STATUSES.has(result?.assessment_status)) return result.assessment_status;
  if (result?.predicted_specialty && (result?.booking_allowed === false || result?.urgency_level === null)) return 'CLARIFY';
  if (!result?.predicted_specialty || result?.booking_allowed !== true) return 'NEEDS_INFORMATION';
  return 'ASSESSED';
};

export const normalizeSymptomTriageResult = (result) => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;

  return {
    predicted_specialty: typeof result.predicted_specialty === 'string' && result.predicted_specialty.trim()
      ? result.predicted_specialty.trim()
      : null,
    specialty_id: Number.isInteger(result.specialty_id) ? result.specialty_id : null,
    recommendation_source: ['AI', 'RULE_BASED'].includes(result.recommendation_source)
      ? result.recommendation_source
      : null,
    assessment_status: getSymptomAssessmentStatus(result),
    urgency_level: VALID_URGENCY_LEVELS.has(result.urgency_level) ? result.urgency_level : null,
    urgency_text: typeof result.urgency_text === 'string' ? result.urgency_text.trim() : '',
    initial_advice: typeof result.initial_advice === 'string' ? result.initial_advice.trim() : '',
    follow_up_questions: Array.isArray(result.follow_up_questions)
      ? result.follow_up_questions.filter((question) => typeof question === 'string' && question.trim()).slice(0, 3)
      : [],
    disclaimer: typeof result.disclaimer === 'string' ? result.disclaimer.trim() : '',
    booking_allowed: result.booking_allowed === true
  };
};

const normalizeMessage = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .toLowerCase();

export const getPatientChatIntent = (message) => {
  const text = normalizeMessage(message);
  const asksDoctor = text.includes('bac si');
  if ((text.includes('chi tiet') && /(buoi kham|lan kham|kham|ho so|benh an)/.test(text))
    || text.includes('benh an') || text.includes('don thuoc') || text.includes('ket qua kham')) return 'VISIT_DETAIL';
  if (asksDoctor && (text.includes('lich') || text.includes('ca kham') || text.includes('lam viec'))) return 'DOCTOR_SCHEDULE';
  if (asksDoctor && /(thong tin|ho so|gioi thieu|la ai)/.test(text)) return 'DOCTOR_PROFILE';
  if ((text.includes('lich kham') || text.includes('buoi kham'))
    && /(toi|cua toi|cua minh|ngay nao|buoi nao|co lich|lich cua)/.test(text)) return 'MY_APPOINTMENTS';
  return null;
};

export const getAssistantNavigationIntent = (message, isAuthenticated = false) => {
  const text = normalizeMessage(message);
  const asksPersonalSchedule = (text.includes('lich') && text.includes('kham') && (
    text.includes('ngay mai')
    || text.includes('cua toi')
    || text.includes('cua minh')
    || text.includes('toi co lich')
    || text.includes('minh co lich')
    || text.includes('lich su')
  ));

  if (asksPersonalSchedule) {
    return isAuthenticated
      ? { message: 'Để xem lịch hẹn của bạn, hãy mở trang lịch sử khám.', action: { text: 'Mở lịch sử khám', link: '/patient/history' }, kind: 'personal_schedule' }
      : { message: 'Bạn cần đăng nhập để xem lịch hẹn của mình.', action: { text: 'Đăng nhập', link: '/login' }, kind: 'personal_schedule' };
  }

  const asksAvailability = (text.includes('bac si') || text.includes('lich truc'))
    && (text.includes('trong') || text.includes('con') || text.includes('ca kham') || text.includes('lich truc'));
  if (asksAvailability) {
    return {
      message: 'Bạn có thể xem bác sĩ và khung giờ đang nhận đặt tại trang đặt lịch. Tôi chưa tra cứu khung giờ cụ thể.',
      action: { text: 'Mở trang đặt lịch', link: '/patient/booking' },
      kind: 'availability'
    };
  }

  return null;
};

export const isServiceAdviceIntent = (message) => {
  const text = normalizeMessage(message);
  return ['dich vu', 'gia', 'chi phi', 'bao nhieu', 'kham gi', 'kham khoa nao']
    .some((phrase) => text.includes(phrase));
};

const containsSymptomSignal = (message) => {
  const text = normalizeMessage(message);
  return /\b(dau|ngua|noi ban|phat ban|man do|mun|ho|sot|met moi|chong mat|kho tho|te yeu|tim dap nhanh|khong khoe|khong biet minh bi gi|khong biet bi benh gi)\b/.test(text)
    || (/\bda mat\b/.test(text) && /\b(xau|khong dep|khong on|co van de)\b/.test(text));
};

export const isDirectServiceLookupIntent = (message) =>
  isServiceAdviceIntent(message) && !containsSymptomSignal(message);

export const shouldRequestServiceAdvice = (_question, result) =>
  isSymptomBookingAllowed(result);

export const formatSymptomReply = (result) => {
  if (result?.urgency_level === 'EMERGENCY') {
    return `${result.urgency_text} ${result.initial_advice}`.trim();
  }

  const specialtyLine = result?.predicted_specialty
    ? `Chuyên khoa có thể phù hợp: ${result.predicted_specialty}.`
    : '';
  const questions = Array.isArray(result?.follow_up_questions)
    ? result.follow_up_questions.slice(0, 3).filter(Boolean)
    : [];
  const questionBlock = questions.length
    ? `\n\nĐể định hướng rõ hơn:\n${questions.map((question) => `• ${question}`).join('\n')}\nBạn có thể bổ sung câu trả lời rồi gửi lại.`
    : '';
  return [specialtyLine, result?.initial_advice, result?.urgency_text]
    .filter(Boolean)
    .join(' ')
    .concat(questionBlock);
};

export const formatMatchedServiceReply = (result) => {
  if (result?.predicted_specialty) {
    return `${formatSymptomReply(result)}\n\nDịch vụ phù hợp theo danh mục:`;
  }
  return 'Trong danh mục đang hoạt động, dịch vụ sau có thể phù hợp với mô tả của bạn:';
};
