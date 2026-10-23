const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const syncInvoiceNotification = async (connection, { invoiceId, totalAmount, paidAmount, forceReview = false }) => {
  const total = Number(totalAmount);
  const paid = Number(paidAmount);
  const due = Math.max(0, total - paid);
  const excess = Math.max(0, paid - total);
  const status = forceReview || excess > 0 ? 'REVIEW' : due > 0 ? 'ACTION_REQUIRED' : 'PAID';
  const message = forceReview
    ? `Lịch liên quan hóa đơn #${invoiceId} đã hủy. Khoản tiền nhận được cần đối soát/hoàn tiền thủ công.`
    : excess > 0
    ? `Hóa đơn #${invoiceId} đã nhận thừa ${formatMoney(excess)}. Phòng khám sẽ đối soát.`
    : due > 0
      ? `Hóa đơn #${invoiceId} đã cập nhật. Số tiền còn thiếu: ${formatMoney(due)}.`
      : `Hóa đơn #${invoiceId} đã được thanh toán đủ.`;
  const [[invoice]] = await connection.query('SELECT patient_id, appointment_id FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) return { changed: false, status, due, excess };
  const dedupeKey = `INVOICE_UPDATED:${invoiceId}:CURRENT`;
  const [result] = await connection.query(
    `INSERT INTO notifications (recipient_user_id, type, title, message, invoice_id, appointment_id, dedupe_key, status)
     VALUES (?, 'INVOICE_UPDATED', 'Cập nhật hóa đơn', ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), message = VALUES(message), status = VALUES(status), is_read = FALSE`,
    [invoice.patient_id, message, invoiceId, invoice.appointment_id, dedupeKey, status]
  );
  await connection.query(
    `UPDATE notifications SET status = 'SUPERSEDED' WHERE invoice_id = ? AND type = 'INVOICE_UPDATED'
     AND dedupe_key <> ? AND status <> 'SUPERSEDED'`, [invoiceId, dedupeKey]
  );
  return { changed: result.affectedRows > 0, status, due, excess };
};

const createMedicalRecordNotification = async (connection, { patientId, appointmentId, recordId }) => {
  const [result] = await connection.query(
    `INSERT INTO notifications (recipient_user_id, type, title, message, appointment_id, dedupe_key, status)
     VALUES (?, 'MEDICAL_RECORD_READY', 'Bệnh án đã sẵn sàng', 'Bác sĩ đã hoàn tất hồ sơ khám của bạn. Hãy đăng nhập để xem bệnh án và đơn thuốc.', ?, ?, 'INFO')
     ON DUPLICATE KEY UPDATE title = VALUES(title), message = VALUES(message), status = 'INFO'`,
    [patientId, appointmentId, `RECORD_READY:${recordId}`]
  );
  return result.affectedRows > 0;
};

const emitNotificationsUpdated = (req, patientId, invoiceId) => {
  req.app.get('io')?.to(`user:${patientId}`).emit('notifications_updated', { invoiceId });
};

module.exports = { formatMoney, syncInvoiceNotification, createMedicalRecordNotification, emitNotificationsUpdated };
