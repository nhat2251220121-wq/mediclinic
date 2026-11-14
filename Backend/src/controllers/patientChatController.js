const { pool } = require('../config/db');

const normalize = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const formatDate = (value) => {
  const parts = String(value || '').slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : 'Chưa cập nhật';
};

const clinicToday = () => {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getIntent = (question) => {
  const text = normalize(question);
  const doctor = /\bbac si\b/.test(text);
  if ((text.includes('chi tiet') && /(buoi kham|lan kham|kham|ho so|benh an)/.test(text))
      || text.includes('benh an') || text.includes('don thuoc')) return 'VISIT_DETAIL';
  if (doctor && (text.includes('lich') || text.includes('ca kham') || text.includes('lam viec'))) return 'DOCTOR_SCHEDULE';
  if (doctor && /(thong tin|ho so|la ai|gioi thieu)/.test(text)) return 'DOCTOR_PROFILE';
  if ((text.includes('lich kham') || text.includes('buoi kham'))
      && /(toi|cua toi|cua minh|ngay nao|buoi nao|co lich|lich cua)/.test(text)) return 'MY_APPOINTMENTS';
  return null;
};

const parseRequestedDate = (question) => {
  const text = normalize(question);
  const today = clinicToday();
  let offset = 0;
  if (text.includes('ngay mai') || text.includes('hom sau')) offset = 1;
  else if (text.includes('hom qua')) offset = -1;
  else if (text.includes('hom nay')) offset = 0;
  else {
    const match = String(question).match(/\b(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{4}))?\b/);
    if (!match) return { error: 'Bạn cho biết ngày cụ thể theo dạng ngày/tháng/năm nhé.' };
    if (!match[3]) return { error: 'Bạn vui lòng ghi cả năm để tôi tra đúng ngày, ví dụ 28/11/2026.' };
    const date = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return { error: 'Ngày bạn nhập chưa hợp lệ. Vui lòng kiểm tra lại ngày/tháng/năm.' };
    return { date };
  }
  const value = new Date(`${today}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return { date: value.toISOString().slice(0, 10) };
};

const timeRequested = (question) => {
  const text = normalize(question);
  const match = text.match(/(?:luc\s*)?(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${(match[2] || '00').padStart(2, '0')}`;
};

const hasDoctorName = (question) => {
  const words = normalize(question).split(' ');
  const stopWords = new Set(['ngay', 'hom', 'luc', 'co', 'lich', 'ca', 'kham', 'trong', 'con', 'nao', 'khung', 'gio', 'nay', 'khong', 'lam', 'viec', 'toi']);
  for (let index = 0; index < words.length - 1; index += 1) {
    if (words[index] !== 'bac' || words[index + 1] !== 'si') continue;
    const candidate = [];
    for (const word of words.slice(index + 2)) {
      if (stopWords.has(word)) break;
      if (/\p{L}/u.test(word)) candidate.push(word);
    }
    if (candidate.length) return true;
  }
  return false;
};

const questionIncludesDate = (question) => {
  const text = normalize(question);
  return /\b(hom nay|ngay mai|hom qua)\b/.test(text)
    || /\b\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{4})?\b/.test(text);
};

const matchDoctor = async (db, question) => {
  const [doctors] = await db.query(
    `SELECT d.id, d.bio, d.experience_years, d.avatar_url, u.full_name, u.phone, u.email,
            s.name AS specialty_name, r.name AS room_name, r.room_number
     FROM doctors d JOIN users u ON u.id = d.user_id
     JOIN specialties s ON s.id = d.specialty_id AND s.is_active = TRUE
     LEFT JOIN rooms r ON r.id = d.room_id
     WHERE d.is_active = TRUE AND u.is_active = TRUE AND u.role = 'DOCTOR'
     ORDER BY u.full_name`
  );
  const text = normalize(question);
  const generic = new Set(['bac', 'si', 'cho', 'toi', 'thong', 'tin', 'cua', 'la', 'gi', 'ho', 'so', 've', 'ngay', 'lich', 'kham', 'co', 'khong', 'lam', 'viec', 'ca', 'nao', 'giup', 'xin']);
  const ranked = doctors.map((doctor) => {
    const tokens = normalize(doctor.full_name).split(' ').filter((token) => token.length > 1 && !generic.has(token));
    return { doctor, score: tokens.filter((token) => text.includes(token)).length };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  if (!ranked.length) return { error: 'Tôi chưa tìm thấy bác sĩ đang hoạt động khớp với tên bạn cung cấp. Bạn thử ghi đầy đủ họ tên nhé.' };
  const best = ranked.filter((entry) => entry.score === ranked[0].score);
  if (best.length > 1) return { error: `Có nhiều bác sĩ có tên gần giống. Bạn muốn hỏi ${best.map(({ doctor }) => doctor.full_name).join(' hay ')}?` };
  return { doctor: ranked[0].doctor };
};

const statusLabel = (status) => ({
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận, chờ khám', COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy', NO_SHOW: 'Không đến khám'
}[status] || 'Chưa cập nhật');

const patientChatController = ({ db = pool } = {}) => ({
  query: async (req, res, next) => {
    try {
      const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
      if (!question || question.length > 500) return res.status(400).json({ success: false, message: 'Câu hỏi phải có nội dung và không dài quá 500 ký tự.' });
      const intent = getIntent(question);
      if (!intent) return res.json({ success: true, data: { kind: 'CLARIFY', message: 'Bạn có thể hỏi thông tin bác sĩ, lịch làm của bác sĩ, lịch khám của mình hoặc chi tiết một lần khám.' } });

      if (intent === 'DOCTOR_PROFILE' || intent === 'DOCTOR_SCHEDULE') {
        if (intent === 'DOCTOR_SCHEDULE' && !hasDoctorName(question)) {
          const clarification = questionIncludesDate(question)
            ? 'Bạn muốn xem lịch hôm đó của bác sĩ nào? Cho tôi biết tên bác sĩ nhé.'
            : 'Bạn muốn xem lịch của bác sĩ nào và ngày nào? Cho tôi biết tên bác sĩ; nếu hỏi một ngày cụ thể, ghi thêm ngày/tháng/năm nhé.';
          return res.json({ success: true, data: {
            kind: intent,
            needs_follow_up: true,
            message: clarification
          } });
        }
        const matched = await matchDoctor(db, question);
        if (matched.error) return res.json({ success: true, data: { kind: intent, needs_follow_up: intent === 'DOCTOR_SCHEDULE', message: matched.error } });
        const doctor = matched.doctor;
        if (intent === 'DOCTOR_PROFILE') {
          return res.json({ success: true, data: {
            kind: intent,
            message: `Thông tin công khai của bác sĩ ${doctor.full_name}:`,
            doctor: {
              full_name: doctor.full_name, specialty_name: doctor.specialty_name, room_name: doctor.room_name,
              room_number: doctor.room_number, bio: doctor.bio, experience_years: doctor.experience_years,
              avatar_url: doctor.avatar_url, phone: doctor.phone || null, email: doctor.email || null
            }
          } });
        }

        const dateResult = parseRequestedDate(question);
        if (dateResult.error) return res.json({ success: true, data: { kind: intent, needs_follow_up: true, message: dateResult.error } });
        const [rows] = await db.query(
          `SELECT sh.name AS shift_name, TIME_FORMAT(st.start_time, '%H:%i') AS start_time, TIME_FORMAT(st.end_time, '%H:%i') AS end_time,
                  st.status AS slot_status, se.status AS shift_status, a.status AS appointment_status
           FROM shift_day_employee sd JOIN shift_employee se ON se.shift_day_employee_id = sd.id
           JOIN shifts sh ON sh.shift_id = se.shift_id
           LEFT JOIN shift_time_slots st ON st.shift_employee_id = se.id
           LEFT JOIN appointments a ON a.slot_id = st.id AND a.status <> 'CANCELLED'
           WHERE sd.doctor_id = ? AND sd.work_date = ?
           ORDER BY sh.start_time, st.start_time`, [doctor.id, dateResult.date]
        );
        const [legacyAppointments] = await db.query(
          `SELECT a.time_slot, a.status AS appointment_status
           FROM appointments a WHERE a.doctor_id = ? AND a.appointment_date = ?
             AND a.slot_id IS NULL AND a.status <> 'CANCELLED'
           ORDER BY a.time_slot`, [doctor.id, dateResult.date]
        );
        const dateLabel = formatDate(dateResult.date);
        if (!rows.length && !legacyAppointments.length) return res.json({ success: true, data: { kind: intent, message: `Bác sĩ ${doctor.full_name} chưa đăng ký ca làm ngày ${dateLabel}.` } });
        const lines = [];
        for (const row of rows) {
          if (!row.start_time) {
            lines.push(`• ${row.shift_name}: ${row.shift_status === 'OFF' ? 'đã khóa' : 'có đăng ký, chưa chia khung khám'}`);
            continue;
          }
          const state = row.appointment_status ? `đã có lịch (${statusLabel(row.appointment_status)})`
            : row.slot_status === 'OFF' || ['OFF', 'FULL'].includes(row.shift_status) ? 'ngừng nhận đặt'
              : row.slot_status === 'BOOKED' ? 'đã được giữ' : 'còn nhận đặt';
          lines.push(`• ${row.start_time}–${row.end_time}: ${state}`);
        }
        legacyAppointments.forEach((appointment) => lines.push(`• Lịch hiện có ${appointment.time_slot}: ${statusLabel(appointment.appointment_status)}.`));
        return res.json({ success: true, data: { kind: intent, message: `Lịch làm của bác sĩ ${doctor.full_name} ngày ${dateLabel}:\n${lines.join('\n')}` } });
      }

      const dateResult = parseRequestedDate(question);
      if (dateResult.error) return res.json({ success: true, data: { kind: intent, message: dateResult.error } });
      if (intent === 'MY_APPOINTMENTS') {
        const [appointments] = await db.query(
          `SELECT a.appointment_id, a.time_slot, a.status, svc.name AS service_name,
                  du.full_name AS doctor_name, r.name AS room_name, i.payment_status
           FROM appointments a JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id
           LEFT JOIN services svc ON svc.id = a.service_id LEFT JOIN rooms r ON r.id = d.room_id
           LEFT JOIN invoices i ON i.appointment_id = a.appointment_id
           WHERE a.patient_id = ? AND a.appointment_date = ?
           ORDER BY a.time_slot, a.appointment_id`, [req.user.id, dateResult.date]
        );
        if (!appointments.length) return res.json({ success: true, data: { kind: intent, message: `Ngày ${formatDate(dateResult.date)}, tôi không tìm thấy lịch khám nào của bạn.` } });
        const lines = appointments.map((item) => `• ${item.time_slot} — ${item.doctor_name}${item.room_name ? `, ${item.room_name}` : ''}${item.service_name ? `, ${item.service_name}` : ''}. Trạng thái: ${statusLabel(item.status)}${item.payment_status ? `; thanh toán: ${item.payment_status === 'PAID' ? 'đã thanh toán' : item.payment_status === 'PARTIAL' ? 'đã thanh toán một phần' : 'chưa thanh toán đủ'}` : ''}.`);
        return res.json({ success: true, data: { kind: intent, message: `Lịch khám của bạn ngày ${formatDate(dateResult.date)}:\n${lines.join('\n')}` } });
      }

      const requestedTime = timeRequested(question);
      const [appointments] = await db.query(
        `SELECT a.appointment_id, a.time_slot, a.status, DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
                d.full_name AS doctor_name, svc.name AS service_name
         FROM appointments a JOIN doctors doc ON doc.id = a.doctor_id JOIN users d ON d.id = doc.user_id
         LEFT JOIN services svc ON svc.id = a.service_id
         WHERE a.patient_id = ? AND a.appointment_date = ? AND a.status IN ('CONFIRMED','COMPLETED')
         ORDER BY a.time_slot`, [req.user.id, dateResult.date]
      );
      const matching = requestedTime
        ? appointments.filter((item) => normalize(item.time_slot).includes(requestedTime))
        : appointments;
      if (matching.length > 1) return res.json({ success: true, data: { kind: intent, message: `Bạn có nhiều buổi khám ngày ${formatDate(dateResult.date)}. Vui lòng ghi thêm giờ khám để tôi mở đúng hồ sơ.` } });
      if (!matching.length) return res.json({ success: true, data: { kind: intent, message: `Tôi chưa tìm thấy buổi khám đã xác nhận hoặc hoàn tất ngày ${formatDate(dateResult.date)} phù hợp với giờ bạn hỏi.` } });
      const appointment = matching[0];
      const [records] = await db.query(
        `SELECT mr.record_id, mr.symptoms, mr.height, mr.weight, mr.blood_pressure, mr.temperature, mr.heart_rate, mr.spo2,
                mr.initial_diagnosis, mr.final_diagnosis, mr.icd10_code, icd.description AS icd10_description,
                mr.treatment_plan, mr.notes, mr.advice, DATE_FORMAT(fv.follow_up_date, '%Y-%m-%d') AS follow_up_date,
                fv.instruction AS follow_up_notes, du.full_name AS doctor_name, svc.name AS service_name
         FROM appointment_records mr JOIN doctors doc ON doc.id = mr.doctor_id JOIN users du ON du.id = doc.user_id
         JOIN appointments a ON a.appointment_id = mr.appointment_id
         LEFT JOIN icd10_codes icd ON icd.code = mr.icd10_code
         LEFT JOIN follow_up_visits fv ON fv.record_id = mr.record_id
         LEFT JOIN services svc ON svc.id = a.service_id
         WHERE mr.patient_id = ? AND mr.appointment_id = ? LIMIT 1`, [req.user.id, appointment.appointment_id]
      );
      if (!records.length) return res.json({ success: true, data: { kind: intent, message: `Tôi tìm thấy lịch khám ngày ${formatDate(dateResult.date)}, nhưng bệnh án chưa được lưu.` } });
      const record = records[0];
      const [prescriptions] = await db.query(
        `SELECT dr.name AS medicine_name, pr.dosage, pr.quantity, un.name AS unit_name, pr.duration,
                pr.frequency, mr.name AS meal_name, pr.instructions
                , (SELECT GROUP_CONCAT(dt.name ORDER BY dt.time_id SEPARATOR ', ')
                   FROM prescription_times pt JOIN dosage_times dt ON dt.time_id = pt.time_id
                   WHERE pt.prescription_id = pr.prescription_id) AS dosage_times
         FROM prescriptions pr JOIN drugs dr ON dr.drug_id = pr.drug_id
         LEFT JOIN units un ON un.unit_id = pr.unit_id LEFT JOIN meal_relations mr ON mr.relation_id = pr.meal_relation_id
         WHERE pr.record_id = ? ORDER BY pr.prescription_id`, [record.record_id]
      );
      const lines = [
        `Chi tiết buổi khám ${formatDate(dateResult.date)} lúc ${appointment.time_slot}:`,
        `Bác sĩ: ${record.doctor_name}${record.service_name ? ` · Dịch vụ: ${record.service_name}` : ''}.`,
        `Triệu chứng: ${record.symptoms || 'Chưa ghi nhận'}.`,
        `Sinh hiệu: mạch ${record.heart_rate ?? 'chưa ghi nhận'} lần/phút; huyết áp ${record.blood_pressure || 'chưa ghi nhận'} mmHg; nhiệt độ ${record.temperature ?? 'chưa ghi nhận'} °C; SpO₂ ${record.spo2 ?? 'chưa ghi nhận'}%; chiều cao ${record.height ?? 'chưa ghi nhận'} cm; cân nặng ${record.weight ?? 'chưa ghi nhận'} kg.`,
        `Chẩn đoán ban đầu: ${record.initial_diagnosis || 'Chưa ghi nhận'}.`,
        `Chẩn đoán cuối cùng: ${record.final_diagnosis || 'Chưa ghi nhận'}.`,
        `Mã ICD-10: ${record.icd10_code ? `${record.icd10_code}${record.icd10_description ? ` — ${record.icd10_description}` : ''}` : 'Chưa ghi nhận'}.`,
        `Kế hoạch điều trị: ${record.treatment_plan || 'Chưa ghi nhận'}.`,
        `Lời dặn: ${record.advice || record.notes || 'Chưa ghi nhận'}.`,
        `Tái khám: ${record.follow_up_date ? `${formatDate(record.follow_up_date)}${record.follow_up_notes ? ` — ${record.follow_up_notes}` : ''}` : 'Chưa ghi nhận'}.`,
        prescriptions.length ? `Đơn thuốc:\n${prescriptions.map((item) => `• ${item.medicine_name}: ${item.dosage}, ${item.quantity} ${item.unit_name || 'đơn vị'}, ${item.duration} ngày${item.dosage_times ? `, thời điểm: ${item.dosage_times}` : ''}${item.frequency ? `, tần suất: ${item.frequency}` : ''}${item.meal_name ? `, ${item.meal_name.toLowerCase()}` : ''}${item.instructions ? `. ${item.instructions}` : ''}`).join('\n')}` : 'Đơn thuốc: Không có đơn thuốc được lưu.'
      ];
      return res.json({ success: true, data: { kind: intent, message: lines.join('\n') } });
    } catch (error) { return next(error); }
  }
});

module.exports = { patientChatController, getIntent, parseRequestedDate };
