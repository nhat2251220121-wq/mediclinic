const VITAL_RULES = Object.freeze({
  height: { label: 'Chiều cao', min: 10, max: 250, warning: 'Chiều cao nằm ngoài khoảng nhập liệu rộng 10–250 cm.' },
  weight: { label: 'Cân nặng', min: 0.3, max: 500, warning: 'Cân nặng nằm ngoài khoảng nhập liệu rộng 0,3–500 kg.' },
  temperature: { label: 'Nhiệt độ', min: 30, max: 45, warning: 'Nhiệt độ nằm ngoài khoảng nhập liệu rộng 30–45 °C.' },
  heart_rate: { label: 'Nhịp tim', min: 20, max: 250, warning: 'Nhịp tim nằm ngoài khoảng nhập liệu rộng 20–250 lần/phút.' },
  spo2: { label: 'SpO₂', min: 70, max: 100, warning: 'SpO₂ thấp hơn 70%; vui lòng kiểm tra lại số liệu.' }
});

const isEmpty = (value) => value === undefined || value === null || value === '';

const validateVitalSigns = (vitals = {}, { acknowledged = false } = {}) => {
  const issues = [];
  const normalized = {};

  for (const [field, rule] of Object.entries(VITAL_RULES)) {
    const value = vitals[field];
    if (isEmpty(value)) {
      normalized[field] = null;
      continue;
    }

    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      issues.push({ field, type: 'error', code: 'INVALID_NUMBER', message: `${rule.label} phải là số không âm hữu hạn.` });
      normalized[field] = null;
      continue;
    }

    normalized[field] = value;
    if (field === 'spo2' && value > 100) {
      issues.push({ field, type: 'error', code: 'SPO2_OVER_100', message: 'SpO₂ không thể lớn hơn 100%.' });
    } else if (value < rule.min || value > rule.max) {
      issues.push({ field, type: 'warning', code: 'OUTSIDE_WIDE_INPUT_RANGE', message: rule.warning });
    }
  }

  let normalizedBloodPressure = null;
  const bloodPressure = vitals.blood_pressure;
  if (!isEmpty(bloodPressure)) {
    if (typeof bloodPressure !== 'string') {
      issues.push({ field: 'blood_pressure', type: 'error', code: 'INVALID_BLOOD_PRESSURE_FORMAT', message: 'Huyết áp phải theo dạng tâm thu/tâm trương, ví dụ 120/80.' });
    } else {
      const match = bloodPressure.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
      if (!match) {
        issues.push({ field: 'blood_pressure', type: 'error', code: 'INVALID_BLOOD_PRESSURE_FORMAT', message: 'Huyết áp phải theo dạng tâm thu/tâm trương, ví dụ 120/80.' });
      } else {
        const systolic = Number(match[1]);
        const diastolic = Number(match[2]);
        if (systolic <= 0 || diastolic <= 0 || systolic <= diastolic) {
          issues.push({ field: 'blood_pressure', type: 'error', code: 'INVALID_BLOOD_PRESSURE_PAIR', message: 'Hãy kiểm tra hai trị số huyết áp; tâm thu phải lớn hơn tâm trương.' });
        } else {
          normalizedBloodPressure = `${systolic}/${diastolic}`;
        }
      }
    }
  }

  normalized.blood_pressure = normalizedBloodPressure;
  const errors = issues.filter((issue) => issue.type === 'error');
  const warnings = issues.filter((issue) => issue.type === 'warning');
  return {
    issues,
    errors,
    warnings,
    normalized,
    valid: errors.length === 0 && (warnings.length === 0 || acknowledged === true),
    requiresAcknowledgement: errors.length === 0 && warnings.length > 0 && acknowledged !== true
  };
};

const normalizeIcd10Code = (value) => {
  if (isEmpty(value)) return { code: null, issue: null };
  if (typeof value !== 'string') {
    return { code: null, issue: { field: 'icd10_code', type: 'error', code: 'INVALID_ICD10_CODE_TYPE', message: 'Mã ICD-10 không hợp lệ.' } };
  }
  const code = value.trim();
  return { code: code || null, issue: null };
};

const icd10CodeExists = async (connection, code) => {
  if (!code) return true;
  const [rows] = await connection.query('SELECT code FROM icd10_codes WHERE code = ? LIMIT 1', [code]);
  return rows.some((row) => row.code === code);
};

module.exports = { VITAL_RULES, validateVitalSigns, normalizeIcd10Code, icd10CodeExists };
