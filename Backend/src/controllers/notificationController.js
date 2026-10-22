const { pool } = require('../config/db');

const listMine = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, type, title, message, invoice_id, appointment_id, status, is_read, created_at, updated_at
       FROM notifications WHERE recipient_user_id = ? ORDER BY created_at DESC LIMIT 100`, [req.user.id]
    );
    const unreadCount = rows.reduce((count, row) => count + (row.is_read ? 0 : 1), 0);
    return res.json({ success: true, data: rows, unreadCount });
  } catch (error) { next(error); }
};

const markRead = async (req, res, next) => {
  try {
    const [result] = await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND recipient_user_id = ?', [req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo của tài khoản này.' });
    req.app.get('io')?.to(`user:${req.user.id}`).emit('notifications_updated', { id: Number(req.params.id) });
    return res.json({ success: true });
  } catch (error) { next(error); }
};

const markAllRead = async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE recipient_user_id = ? AND is_read = FALSE', [req.user.id]);
    req.app.get('io')?.to(`user:${req.user.id}`).emit('notifications_updated', {});
    return res.json({ success: true });
  } catch (error) { next(error); }
};

module.exports = { listMine, markRead, markAllRead };
