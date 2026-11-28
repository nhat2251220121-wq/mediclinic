const CLINIC_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const isEarlyExamDemoEnabled = (value = process.env.ALLOW_EARLY_EXAM_DEMO) =>
  typeof value === 'string' && value.trim().toLowerCase() === 'true';

const clinicLocalMinute = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

const appointmentStartMinute = (appointmentDate, timeSlot) => {
  const date = typeof appointmentDate === 'string'
    ? appointmentDate.slice(0, 10)
    : appointmentDate instanceof Date && !Number.isNaN(appointmentDate.getTime())
      ? appointmentDate.toISOString().slice(0, 10)
      : '';
  const match = String(timeSlot || '').match(/(?:^|\b)(\d{1,2}):(\d{2})(?:\b|$)/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const isAppointmentStartReached = ({ appointmentDate, timeSlot, now = new Date() } = {}) => {
  const start = appointmentStartMinute(appointmentDate, timeSlot);
  const current = clinicLocalMinute(now);
  if (!start || !current) return false;
  return current >= start;
};

module.exports = {
  CLINIC_TIME_ZONE,
  isEarlyExamDemoEnabled,
  appointmentStartMinute,
  isAppointmentStartReached
};
