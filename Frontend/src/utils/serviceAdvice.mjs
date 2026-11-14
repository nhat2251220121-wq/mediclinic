const STATUS = new Set(['MATCHED', 'CLARIFY', 'NOT_FOUND', 'EMERGENCY']);

export const normalizeServiceAdviceResult = (data, responseMessage = '') => {
  const status = STATUS.has(data?.status)
    ? data.status
    : data?.emergency ? 'EMERGENCY'
      : data?.clarification_required ? 'CLARIFY'
        : data?.services?.length ? 'MATCHED' : 'NOT_FOUND';
  const defaults = {
    MATCHED: 'Đã tìm thấy dịch vụ phù hợp trong danh mục đang hoạt động.',
    CLARIFY: 'Bạn có thể mô tả rõ hơn nhu cầu hoặc dấu hiệu đang gặp không?',
    NOT_FOUND: 'Chưa tìm thấy dịch vụ phù hợp trong danh mục đang hoạt động.',
    EMERGENCY: 'Dấu hiệu cần được xử lý cấp cứu ngay. Không tiếp tục đặt lịch thông thường.'
  };
  const services = status === 'MATCHED' && Array.isArray(data?.services) ? data.services.slice(0, 1) : [];

  return {
    status,
    message: responseMessage || defaults[status],
    services,
    doctorsIncluded: Boolean(data?.doctors_included),
    bookingAllowed: status === 'MATCHED' && data?.booking_allowed === true,
    noServiceMatch: status === 'NOT_FOUND',
    emergency: status === 'EMERGENCY'
  };
};

export const getServiceBookingNavigation = (serviceId, isPatient = false) => {
  const search = `?service_id=${encodeURIComponent(serviceId)}`;
  return isPatient
    ? { path: `/patient/booking${search}` }
    : { path: '/login', options: { state: { from: { pathname: '/patient/booking', search } } } };
};
