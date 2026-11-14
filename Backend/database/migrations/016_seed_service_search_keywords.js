const keywordGroups = [
  { specialty: /rang|nha khoa/, service: /rang|nha khoa/, keywords: 'răng, đau răng, nhức răng, ê buốt, răng khôn, nướu, lợi' },
  { specialty: /da lieu/, service: /da lieu/, keywords: 'da, nổi mụn, ngứa da, nổi mẩn, phát ban, rụng tóc, móng bất thường' },
  { specialty: /tai mui hong/, service: /tai|mui|hong/, keywords: 'tai, đau tai, ù tai, mũi, nghẹt mũi, sổ mũi, xoang, họng, đau họng, khàn tiếng' },
  { specialty: /nhi/, service: /nhi/, keywords: 'bé, trẻ, con tôi, trẻ em, khám nhi, sức khỏe trẻ' },
  { specialty: /san|phu khoa/, service: /san|phu khoa/, keywords: 'thai, mang thai, sản, phụ khoa, kinh nguyệt, sức khỏe sinh sản' },
  { specialty: /noi tong quat/, service: /noi tong quat/, keywords: 'khám tổng quát, người lớn mệt mỏi, chóng mặt, đau bụng, rối loạn tiêu hóa' }
];

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .toLowerCase()
  .trim();

exports.up = async (connection) => {
  const [services] = await connection.query(`
    SELECT svc.id, svc.name, sp.name AS specialty_name
    FROM services svc
    JOIN specialties sp ON sp.id = svc.specialty_id
    WHERE svc.is_active = TRUE AND sp.is_active = TRUE
      AND (svc.search_keywords IS NULL OR TRIM(svc.search_keywords) = '')
  `);

  for (const service of services) {
    const specialtyName = normalize(service.specialty_name);
    const serviceName = normalize(service.name);
    const group = keywordGroups.find(({ specialty, service: servicePattern }) => (
      specialty.test(specialtyName) && servicePattern.test(serviceName)
    ));
    if (!group) continue;
    await connection.query(`
      UPDATE services
      SET search_keywords = ?
      WHERE id = ? AND is_active = TRUE
        AND (search_keywords IS NULL OR TRIM(search_keywords) = '')
    `, [group.keywords, service.id]);
  }
};

exports.keywordGroups = keywordGroups;
