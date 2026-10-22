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
  const [result] = await connection.query(
    `UPDATE notifications SET status = ?, message = ?
     WHERE invoice_id = ? AND type = 'INVOICE_UPDATED' AND status <> 'SUPERSEDED'`,
    [status, message, invoiceId]
  );
  return { changed: result.affectedRows > 0, status, due, excess };
};

const emitNotificationsUpdated = (req, patientId, invoiceId) => {
  req.app.get('io')?.to(`user:${patientId}`).emit('notifications_updated', { invoiceId });
};

module.exports = { formatMoney, syncInvoiceNotification, emitNotificationsUpdated };
