// Repair databases where the time-slot table exists but its status enum was
// left at the pre-booking values. This is additive and preserves existing
// AVAILABLE/OFF rows.
exports.up = async (connection) => {
  const [[column]] = await connection.query(
    `SELECT COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'shift_time_slots'
       AND COLUMN_NAME = 'status'`
  );

  if (!column) {
    throw new Error('shift_time_slots.status is missing; apply the appointment time-slot migration first.');
  }

  if (!column.COLUMN_TYPE.includes("'BOOKED'")) {
    await connection.query(
      "ALTER TABLE shift_time_slots MODIFY COLUMN status ENUM('AVAILABLE','BOOKED','OFF') NOT NULL DEFAULT 'AVAILABLE'"
    );
  }
};
