const FOLLOW_UP_BOOKING_STATUSES = new Set(['PENDING', 'CONFIRMED']);

const resolveFollowUpStatus = (row = {}) => {
  const { active_appointment_id, completed_appointment_id, completed_has_record } = row;
  const hasActive = Boolean(active_appointment_id);
  const hasCompleted = Boolean(completed_appointment_id);
  if (hasActive && hasCompleted) return 'DATA_ISSUE';
  if (hasCompleted) return Number(completed_has_record) === 1 || completed_has_record === true ? 'COMPLETED' : 'DATA_ISSUE';
  if (Object.prototype.hasOwnProperty.call(row, 'source_specialty_id') && !row.source_specialty_id) return 'DATA_ISSUE';
  return hasActive ? 'BOOKED' : 'NOT_BOOKED';
};

const decorateFollowUp = (row) => {
  const follow_up_status = resolveFollowUpStatus(row);
  return {
    ...row,
    follow_up_status,
    can_book: follow_up_status === 'NOT_BOOKED',
    can_rebook: follow_up_status === 'NOT_BOOKED',
    active_appointment_id: row.active_appointment_id ? Number(row.active_appointment_id) : null,
    completed_appointment_id: row.completed_appointment_id ? Number(row.completed_appointment_id) : null,
    latest_appointment_id: row.latest_appointment_id ? Number(row.latest_appointment_id) : null
  };
};

const isFollowUpBookingStatus = (status) => FOLLOW_UP_BOOKING_STATUSES.has(status);

const validateFollowUpBooking = ({ followUp, linkedAppointments = [], patientId, selectedServiceSpecialtyId }) => {
  if (!followUp) return { status: 404, message: 'Không tìm thấy lời hẹn tái khám.' };
  if (Number(followUp.patient_id) !== Number(patientId)) return { status: 403, message: 'Lời hẹn tái khám không thuộc tài khoản của bạn.' };
  const completed = linkedAppointments.find((item) => item.status === 'COMPLETED');
  if (completed) return {
    status: 409,
    message: Number(completed.has_medical_record)
      ? 'Lời hẹn tái khám này đã hoàn tất, không thể đặt thêm.'
      : 'Lời hẹn có lịch đã đánh dấu hoàn tất nhưng thiếu bệnh án. Vui lòng liên hệ phòng khám để đối soát.'
  };
  if (linkedAppointments.some((item) => isFollowUpBookingStatus(item.status))) {
    return { status: 409, message: 'Lời hẹn tái khám đã có lịch đang chờ hoặc đã xác nhận.' };
  }
  if (!followUp.source_specialty_id) return { status: 409, message: 'Không xác định được chuyên khoa của lời hẹn tái khám. Vui lòng liên hệ phòng khám.' };
  if (selectedServiceSpecialtyId != null && followUp.source_specialty_id && Number(selectedServiceSpecialtyId) !== Number(followUp.source_specialty_id)) {
    return { status: 409, message: 'Dịch vụ tái khám phải thuộc cùng chuyên khoa với lời hẹn ban đầu.' };
  }
  return null;
};

module.exports = { FOLLOW_UP_BOOKING_STATUSES, resolveFollowUpStatus, decorateFollowUp, isFollowUpBookingStatus, validateFollowUpBooking };
