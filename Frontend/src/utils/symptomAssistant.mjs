export const isSymptomBookingAllowed = (result) => Boolean(
  result?.booking_allowed
  && result?.urgency_level !== 'EMERGENCY'
  && result?.specialty_id !== null
  && result?.specialty_id !== undefined
  && Number.isInteger(result?.specialty_id)
  && typeof result?.predicted_specialty === 'string'
  && result.predicted_specialty.trim()
);

const normalizeMessage = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .toLowerCase();

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
