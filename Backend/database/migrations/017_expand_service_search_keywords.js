const keywordGroups = [
  {
    specialty: /rang|nha khoa/,
    service: /rang|nha khoa/,
    keywords: 'răng, đau răng, nhức răng, ê buốt, sâu răng, mẻ răng, mất răng, răng lung lay, răng khôn, mọc lệch, nướu, lợi, chảy máu lợi, viêm lợi, cao răng, vôi răng, đau hàm, khớp hàm, khó há miệng, khớp cắn, loét miệng, lưỡi, niêm mạc miệng, niềng răng'
  },
  {
    specialty: /da lieu/,
    service: /da lieu/,
    keywords: 'da, nổi mụn, mụn trứng cá, nhọt, chốc lở, viêm nang lông, ngứa da, ghẻ, lang ben, hắc lào, nấm da, nấm móng, thủy đậu, zona, giời leo, mụn cóc, herpes, mày đay, chàm, eczema, viêm da cơ địa, viêm da tiếp xúc, dị ứng thuốc, vảy nến, á sừng, bạch biến, nám, tàn nhang, rụng tóc, móng giòn, móng mọc ngược, nốt ruồi thay đổi, u da'
  },
  {
    specialty: /tai mui hong/,
    service: /tai|mui|hong/,
    keywords: 'tai, đau tai, ù tai, nghe kém, mũi, đau mũi, nghẹt mũi, sổ mũi, chảy mũi, hắt hơi, xoang, họng, đau họng, khàn tiếng, khó nuốt, amidan, viêm tai, viêm xoang, polyp mũi, thanh quản, chóng mặt, mất thăng bằng'
  },
  {
    specialty: /nhi/,
    service: /nhi/,
    keywords: 'nhi, nhi khoa, trẻ em, trẻ sơ sinh, bé, con tôi, em bé, sốt, ho, khó thở, sổ mũi, đau họng, đau bụng, buồn nôn, nôn ói, tiêu chảy, táo bón, dị ứng, dinh dưỡng, chậm tăng cân, chiều cao, cân nặng, vòng đầu, phát triển, tiêm chủng'
  },
  {
    specialty: /san|phu khoa/,
    service: /san|phu khoa/,
    keywords: 'sản, phụ khoa, kinh nguyệt, đau bụng kinh, rối loạn kinh nguyệt, khí hư, huyết trắng, ngứa rát vùng kín, đau bụng dưới, chảy máu bất thường, đau khi quan hệ, sức khỏe sinh sản, khám phụ khoa định kỳ, mang thai, thai kỳ, siêu âm thai, trước khi mang thai, sau sinh, vú'
  },
  {
    specialty: /noi tong quat/,
    service: /noi tong quat/,
    keywords: 'người lớn, khám tổng quát, khám sức khỏe, mệt mỏi, chóng mặt, đau đầu, sốt, ho, đau họng, đau bụng, rối loạn tiêu hóa, huyết áp, đường huyết, mỡ máu, tiểu đường, tuyến giáp, gout, đau khớp, đau cột sống, tim mạch, hô hấp'
  }
];

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, ' ');

const splitKeywords = (value) => String(value || '')
  .split(/[,;\n]/)
  .map((keyword) => keyword.trim())
  .filter(Boolean);

const mergeKeywords = (existing, additions) => {
  const merged = splitKeywords(existing);
  const seen = new Set(merged.map(normalize));
  for (const keyword of splitKeywords(additions)) {
    const key = normalize(keyword);
    if (!seen.has(key)) {
      merged.push(keyword);
      seen.add(key);
    }
  }
  return merged.join(', ');
};

exports.up = async (connection) => {
  const [services] = await connection.query(`
    SELECT svc.id, svc.name, svc.specialty_id, svc.search_keywords, sp.name AS specialty_name
    FROM services svc
    JOIN specialties sp ON sp.id = svc.specialty_id
    WHERE svc.is_active = TRUE AND sp.is_active = TRUE
  `);

  for (const service of services) {
    const specialtyName = normalize(service.specialty_name);
    const serviceName = normalize(service.name);
    const group = keywordGroups.find(({ specialty, service: servicePattern }) => (
      specialty.test(specialtyName) && servicePattern.test(serviceName)
    ));
    if (!group) continue;

    const keywords = mergeKeywords(service.search_keywords, group.keywords);
    if (keywords === String(service.search_keywords || '').trim()) continue;
    await connection.query(`
      UPDATE services
      SET search_keywords = ?
      WHERE id = ? AND specialty_id = ? AND is_active = TRUE
    `, [keywords, service.id, service.specialty_id]);
  }
};

exports.keywordGroups = keywordGroups;
exports.mergeKeywords = mergeKeywords;
