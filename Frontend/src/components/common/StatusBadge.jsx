import React from 'react';

/**
 * Component hiển thị nhãn trạng thái trực quan với màu sắc chuẩn
 */
const StatusBadge = ({ status, type = 'appointment' }) => {
  const getBadgeStyle = () => {
    if (type === 'appointment') {
      switch (status) {
        case 'PENDING':
          return { label: 'Chờ xác nhận', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
        case 'CONFIRMED':
          return { label: 'Đã xác nhận', bg: 'bg-blue-100 text-blue-800 border-blue-200' };
        case 'COMPLETED':
          return { label: 'Đã khám xong', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        case 'CANCELLED':
          return { label: 'Đã hủy', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
        default:
          return { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
      }
    }

    if (type === 'payment') {
      switch (status) {
        case 'PAID':
          return { label: 'Đã thanh toán', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        case 'UNPAID':
          return { label: 'Chưa thanh toán', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
        default:
          return { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
      }
    }

    if (type === 'urgency') {
      switch (status) {
        case 'LOW':
          return { label: 'Bình thường', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
        case 'MEDIUM':
          return { label: 'Cần chú ý', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
        case 'HIGH':
          return { label: 'Khẩn thiết', bg: 'bg-orange-100 text-orange-800 border-orange-200' };
        case 'EMERGENCY':
          return { label: 'Cấp cứu ngay', bg: 'bg-red-100 text-red-800 border-red-200 animate-pulse' };
        default:
          return { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
      }
    }

    return { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  const { label, bg } = getBadgeStyle();

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${bg}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
