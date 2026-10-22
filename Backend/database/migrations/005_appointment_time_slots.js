const addColumn = async (connection, table, column, definition) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [table, column]
  );
  if (!row.found) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
};

const minutesOf = (value) => {
  const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
};

exports.up = async (connection) => {
  const slotMinutes = Number(process.env.BOOKING_SLOT_MINUTES || 30);
  if (!Number.isInteger(slotMinutes) || slotMinutes < 10 || slotMinutes > 120) {
    throw new Error('BOOKING_SLOT_MINUTES must be an integer from 10 to 120.');
  }

  await connection.query(`CREATE TABLE IF NOT EXISTS shift_time_slots (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    shift_employee_id INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('AVAILABLE','BOOKED','OFF') NOT NULL DEFAULT 'AVAILABLE',
    UNIQUE KEY uq_shift_employee_start (shift_employee_id, start_time),
    INDEX idx_shift_slots_status (shift_employee_id, status, start_time),
    CONSTRAINT fk_shift_time_slots_employee FOREIGN KEY (shift_employee_id) REFERENCES shift_employee(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await connection.query("ALTER TABLE shift_time_slots MODIFY status ENUM('AVAILABLE','BOOKED','OFF') NOT NULL DEFAULT 'AVAILABLE'");
  await addColumn(connection, 'appointments', 'slot_id', 'INT NULL');
  const [[slotIndex]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'appointments' AND index_name = 'uq_appointments_slot_id'`
  );
  if (!slotIndex.found) await connection.query('CREATE UNIQUE INDEX uq_appointments_slot_id ON appointments(slot_id)');
  const [[slotFk]] = await connection.query(
    `SELECT COUNT(*) AS found FROM information_schema.referential_constraints
     WHERE constraint_schema = DATABASE() AND table_name = 'appointments' AND constraint_name = 'fk_appointments_time_slot'`
  );
  if (!slotFk.found) await connection.query('ALTER TABLE appointments ADD CONSTRAINT fk_appointments_time_slot FOREIGN KEY (slot_id) REFERENCES shift_time_slots(id) ON DELETE RESTRICT');

  // Preserve old appointments exactly as stored. Backfill only shifts with no live appointment;
  // a booked full-shift legacy row stays unavailable until that booking is handled normally.
  const [shifts] = await connection.query(
    `SELECT se.id, TIME_FORMAT(sh.start_time, '%H:%i') AS start_time, TIME_FORMAT(sh.end_time, '%H:%i') AS end_time
     FROM shift_employee se JOIN shifts sh ON sh.shift_id = se.shift_id
     WHERE se.status <> 'OFF' AND NOT EXISTS (
       SELECT 1 FROM appointments a WHERE a.shift_employee_id = se.id AND a.status <> 'CANCELLED'
     )`
  );
  let created = 0;
  for (const shift of shifts) {
    await connection.query("UPDATE shift_employee SET status = 'AVAILABLE' WHERE id = ?", [shift.id]);
    const start = minutesOf(shift.start_time);
    const end = minutesOf(shift.end_time);
    if (end <= start || (end - start) % slotMinutes !== 0) continue;
    for (let minute = start; minute < end; minute += slotMinutes) {
      const asTime = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}:00`;
      const [result] = await connection.query(
        `INSERT IGNORE INTO shift_time_slots (shift_employee_id, start_time, end_time, status)
         VALUES (?, ?, ?, 'AVAILABLE')`, [shift.id, asTime(minute), asTime(minute + slotMinutes)]
      );
      created += result.affectedRows;
    }
  }
  console.log(`[Database] Backfilled ${created} unbooked doctor appointment slots (${slotMinutes} minutes each).`);
};
