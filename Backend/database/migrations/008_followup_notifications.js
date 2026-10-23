exports.up = async (connection) => {
  const [[table]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'notifications'`
  );
  if (!table.found) return;

  const [[column]] = await connection.query(
    `SELECT column_type FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'notifications' AND column_name = 'status'`
  );
  if (!column) throw new Error('Không tìm thấy cột notifications.status.');
  if (!String(column.column_type).includes("'INFO'")) {
    await connection.query(
      "ALTER TABLE notifications MODIFY status ENUM('ACTION_REQUIRED','PAID','REVIEW','SUPERSEDED','INFO') NOT NULL DEFAULT 'ACTION_REQUIRED'"
    );
  }
};
