import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { ArrowLeft, Plus, Printer, Save, Trash2 } from 'lucide-react';

const blankVitals = { height: '', weight: '', blood_pressure: '', temperature: '', heart_rate: '', spo2: '' };
const missing = (value) => value === undefined || value === null || value === '' ? 'Chưa ghi nhận' : value;
const dateLabel = (value) => value ? String(value).slice(0, 10).split('-').reverse().join('/') : 'Chưa ghi nhận';
const mealLabel = (name) => name === 'Trong khi ăn' ? 'Trong bữa ăn' : name || 'Không chỉ định';
const safeNumber = (value) => value === '' ? null : Number(value);

function Detail({ label, children, className = '' }) {
  return <div className={className}><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{children || 'Chưa ghi nhận'}</div></div>;
}

const ExaminationPrescription = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointmentId');
  const [appointment, setAppointment] = useState(null);
  const [history, setHistory] = useState([]);
  const [catalog, setCatalog] = useState({ drugs: [], units: [], dosage_times: [], meal_relations: [], icd10_codes: [] });
  const [vitals, setVitals] = useState(blankVitals);
  const [form, setForm] = useState({ symptoms: '', initial_diagnosis: '', final_diagnosis: '', icd10_code: '', treatment_plan: '', advice: '', follow_up_date: '', follow_up_notes: '' });
  const [icdSearch, setIcdSearch] = useState('');
  const [prescriptions, setPrescriptions] = useState([]);
  const [savedRecord, setSavedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [vitalsAcknowledged, setVitalsAcknowledged] = useState(false);

  const loadSavedRecord = async (recordId) => {
    try {
      const detail = await axiosClient.get(`/medical-records/${recordId}`);
      setSavedRecord(detail.data);
      setDetailError('');
    } catch (requestError) {
      setDetailError(requestError.message || 'Bệnh án đã lưu; chưa tải được chi tiết. Hãy tải lại chi tiết, không lưu bệnh án lần nữa.');
    }
  };

  useEffect(() => {
    if (!appointmentId) { setLoading(false); return; }
    axiosClient.get(`/appointments/${appointmentId}`).then(async (appointmentResult) => {
      const activeAppointment = appointmentResult.data;
      const [historyResult, catalogResult] = await Promise.all([
        axiosClient.get(`/medical-records?patient_id=${activeAppointment.patient_id}`),
        axiosClient.get('/medical-records/catalog')
      ]);
      setAppointment(activeAppointment);
      setHistory((historyResult.data || []).filter((record) => Number(record.appointment_id) !== Number(appointmentId)));
      setCatalog(catalogResult.data);
      setForm((current) => ({ ...current, symptoms: activeAppointment.initial_symptoms || '' }));
      const existingRecord = (historyResult.data || []).find((record) => Number(record.appointment_id) === Number(appointmentId));
      if (activeAppointment.status !== 'CONFIRMED' && !existingRecord) setError('Lịch hẹn này chưa được xác nhận hoặc đã kết thúc.');
      if (existingRecord) await loadSavedRecord(existingRecord.record_id || existingRecord.id);
    }).catch((requestError) => setError(requestError.message || 'Không tải được lịch hẹn hoặc danh mục khám.'))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateVital = (key, value) => { setVitals((current) => ({ ...current, [key]: value })); setVitalsAcknowledged(false); };
  const addPrescription = () => setPrescriptions((current) => [...current, { medicine_id: '', quantity: 1, dosage: '', duration_days: 1, meal_relation_id: '', usage_instruction: '', dispensing_source: 'CLINIC' }]);
  const updatePrescription = (index, key, value) => setPrescriptions((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const removePrescription = (index) => setPrescriptions((current) => current.filter((_, i) => i !== index));

  const vitalIssues = useMemo(() => {
    const issues = [];
    for (const [key, label] of [['height','Chiều cao'],['weight','Cân nặng'],['temperature','Nhiệt độ'],['heart_rate','Nhịp tim'],['spo2','SpO₂']]) {
      const value = vitals[key];
      if (value === '') continue;
      if (!/^\d+(\.\d+)?$/.test(String(value)) || !Number.isFinite(Number(value)) || Number(value) < 0) {
        issues.push(`${label} phải là số không âm hợp lệ.`);
      }
    }
    if (vitals.spo2 !== '' && /^\d+(\.\d+)?$/.test(String(vitals.spo2)) && Number(vitals.spo2) > 100) issues.push('SpO₂ không thể lớn hơn 100%.');
    const plausibility = [
      ['height', 10, 250, 'Chiều cao nằm ngoài khoảng nhập liệu rộng 10–250 cm.'],
      ['weight', 0.3, 500, 'Cân nặng nằm ngoài khoảng nhập liệu rộng 0,3–500 kg.'],
      ['temperature', 30, 45, 'Nhiệt độ nằm ngoài khoảng nhập liệu rộng 30–45 °C.'],
      ['heart_rate', 20, 250, 'Nhịp tim nằm ngoài khoảng nhập liệu rộng 20–250 lần/phút.'],
      ['spo2', 70, 100, 'SpO₂ thấp hơn 70%; vui lòng kiểm tra lại số liệu.']
    ];
    for (const [key, min, max, message] of plausibility) {
      const value = vitals[key];
      if (value !== '' && /^\d+(\.\d+)?$/.test(String(value)) && (Number(value) < min || Number(value) > max) && !(key === 'spo2' && Number(value) > 100)) issues.push(message);
    }
    if (vitals.blood_pressure && !/^\s*\d{2,3}\s*\/\s*\d{2,3}\s*$/.test(vitals.blood_pressure)) issues.push('Huyết áp chưa theo định dạng thường dùng “tâm thu/tâm trương”; hãy kiểm tra lại.');
    return issues;
  }, [vitals]);
  const hasHardVitalError = vitalIssues.some((message) => message.includes('phải là số') || message.includes('không thể lớn hơn'));

  const filteredIcdCodes = useMemo(() => {
    const term = icdSearch.trim().toLocaleLowerCase('vi');
    return (catalog.icd10_codes || []).filter((item) => !term || `${item.code} ${item.description}`.toLocaleLowerCase('vi').includes(term));
  }, [catalog.icd10_codes, icdSearch]);

  const save = async (event) => {
    event.preventDefault(); setError('');
    if (hasHardVitalError) { setError('Vui lòng sửa định dạng sinh hiệu không hợp lệ trước khi lưu.'); return; }
    if (vitalIssues.length && !vitalsAcknowledged) { setError('Hãy kiểm tra các cảnh báo sinh hiệu và xác nhận trước khi lưu.'); return; }
    const unavailableClinicDrug = prescriptions.find((item) => {
      if (item.dispensing_source !== 'CLINIC') return false;
      const drug = catalog.drugs.find((row) => Number(row.drug_id) === Number(item.medicine_id));
      return !drug || !drug.is_active || Number(drug.price) <= 0 || Number(drug.available_quantity) < Number(item.quantity);
    });
    if (unavailableClinicDrug) {
      const drug = catalog.drugs.find((row) => Number(row.drug_id) === Number(unavailableClinicDrug.medicine_id));
      setError(`Không thể kê “${drug?.name || 'thuốc này'}” theo nguồn phòng khám cấp vì giá hoặc tồn lô còn hạn chưa đủ. Hãy kiểm tra số lượng hoặc xác nhận bệnh nhân tự mua ngoài.`);
      return;
    }
    setSaving(true);
    try {
      const response = await axiosClient.post('/medical-records', {
        appointment_id: Number(appointmentId),
        ...Object.fromEntries(Object.entries(vitals).map(([key, value]) => [key, key === 'blood_pressure' ? (value || null) : safeNumber(value)])),
        ...form,
        prescriptions: prescriptions.map((item) => ({
          medicine_id: Number(item.medicine_id), quantity: Number(item.quantity), dosage: item.dosage,
          dispensing_source: item.dispensing_source,
          duration_days: Number(item.duration_days), meal_relation_id: item.meal_relation_id ? Number(item.meal_relation_id) : null,
          usage_instruction: item.usage_instruction
        }))
      });
      setSavedRecord({ id: response.data.record_id, record_id: response.data.record_id });
      await loadSavedRecord(response.data.record_id);
    } catch (requestError) { setError(requestError.message || 'Không thể lưu bệnh án.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Đang tải lịch khám…</div>;
  if (!appointment) return <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-700">Chưa chọn lịch hẹn. Hãy mở hồ sơ từ hàng đợi khám để tải đúng bệnh nhân.</p><button onClick={() => navigate('/doctor/queue')} className="text-sm font-medium text-sky-700">Quay lại hàng đợi</button></div>;
  if (appointment.status !== 'CONFIRMED' && !savedRecord) return <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6"><p className="text-sm text-amber-900">{error || 'Lịch này không thể tiếp tục khám.'}</p><button onClick={() => navigate('/doctor/queue')} className="text-sm font-medium text-sky-800">Quay lại hàng đợi</button></div>;

  const savedVitals = savedRecord ? [
    ['Chiều cao', savedRecord.height, 'cm'], ['Cân nặng', savedRecord.weight, 'kg'], ['Huyết áp', savedRecord.blood_pressure, 'mmHg'],
    ['Nhiệt độ', savedRecord.temperature, '°C'], ['Nhịp tim', savedRecord.heart_rate, 'lần/phút'], ['SpO₂', savedRecord.spo2, '%']
  ] : [];

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5">
      <div><button type="button" onClick={() => navigate('/doctor/queue')} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600"><ArrowLeft className="h-4 w-4" /> Hàng đợi</button>
        <h1 className="text-xl font-semibold text-slate-900">Khám bệnh · Lịch #{appointment.appointment_id}</h1>
      </div>
      {savedRecord?.patient_name && <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"><Printer className="h-4 w-4" /> In phiếu A4</button>}
    </header>

    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {savedRecord && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Bệnh án đã được lưu. Phí thuốc đã được tính vào hóa đơn; bước giao thuốc riêng chỉ cập nhật tồn kho.</div>}
    {detailError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{detailError} <button className="ml-2 underline" onClick={() => loadSavedRecord(savedRecord.id)}>Tải lại chi tiết</button></div>}

    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Thông tin bệnh nhân và lần khám</h2>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Bệnh nhân">{appointment.patient_name}</Detail><Detail label="Điện thoại">{appointment.patient_phone}</Detail>
        <Detail label="Ngày giờ">{dateLabel(appointment.appointment_date)} · {appointment.time_slot || 'Chưa ghi nhận'}</Detail>
        <Detail label="Dịch vụ / phòng">{appointment.service_name || 'Khám'} · {appointment.room_name || appointment.room_number || 'Chưa ghi nhận'}</Detail>
        <Detail label="Ngày sinh">{dateLabel(appointment.patient_date_of_birth)}</Detail><Detail label="Giới tính">{appointment.patient_gender}</Detail>
        <Detail label="BHYT">{appointment.patient_insurance_code}</Detail><Detail label="Nghề nghiệp">{appointment.patient_job}</Detail>
        <Detail label="Liên hệ khẩn cấp">{appointment.patient_emergency_contact}</Detail><Detail label="Địa chỉ" className="sm:col-span-2">{appointment.patient_address}</Detail>
      </div>
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-3 text-sm font-semibold">Lịch sử khám trước đây · không bao gồm lần khám hiện tại</h2>{history.length ? <div className="space-y-2">{history.map((record) => <div key={record.record_id} className="rounded-lg bg-slate-50 p-3 text-sm"><strong>{dateLabel(record.appointment_date)}</strong> · {record.doctor_name} · {record.service_name || 'Khám'}<p className="mt-1"><strong>Chẩn đoán:</strong> {record.final_diagnosis || 'Chưa ghi nhận'}</p>{record.prescriptions?.length ? <div className="mt-1 text-xs text-slate-600"><strong>Đơn thuốc:</strong> {record.prescriptions.map((drug) => `${drug.medicine_name} · ${drug.quantity} ${drug.unit_name || ''} · ${drug.dosage} · ${drug.duration} ngày`).join('; ')}</div> : <p className="mt-1 text-xs text-slate-500">Không có đơn thuốc.</p>}</div>)}</div> : <p className="text-sm text-slate-500">Chưa có lịch sử khám.</p>}</section>

    {savedRecord?.patient_name && <section className="space-y-5 rounded-xl border border-emerald-200 bg-white p-5 text-sm">
      <div><h2 className="text-lg font-semibold text-slate-900">Bệnh án đã lưu</h2><p className="mt-1 text-xs text-slate-500">Chế độ chỉ đọc · lần khám {dateLabel(savedRecord.appointment_date)} · lịch #{savedRecord.appointment_id}</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Bệnh nhân">{savedRecord.patient_name}</Detail><Detail label="Bác sĩ">{savedRecord.doctor_name}</Detail>
        <Detail label="Ngày giờ khám">{dateLabel(savedRecord.appointment_date)} · {savedRecord.time_slot}</Detail><Detail label="Mã hồ sơ">{savedRecord.record_id}</Detail>
      </div>
      <section><h3 className="mb-3 font-semibold text-slate-800">Sinh hiệu</h3><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{savedVitals.map(([label, value, unit]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-medium">{missing(value)}{value !== null && value !== undefined && value !== '' ? ` ${unit}` : ''}</div></div>)}</div></section>
      <section className="grid gap-4 sm:grid-cols-2"><Detail label="Triệu chứng và diễn biến" className="rounded-lg border p-3">{savedRecord.symptoms}</Detail><Detail label="Chẩn đoán ban đầu" className="rounded-lg border p-3">{savedRecord.initial_diagnosis}</Detail><Detail label="Chẩn đoán cuối cùng" className="rounded-lg border p-3">{savedRecord.final_diagnosis}</Detail><Detail label="Mã ICD-10" className="rounded-lg border p-3">{savedRecord.icd10_code ? `${savedRecord.icd10_code} · ${savedRecord.icd10_description || 'Chưa có tên trong danh mục hiện tại'}` : 'Không chỉ định'}</Detail></section>
      <section className="grid gap-4 sm:grid-cols-2"><Detail label="Kế hoạch điều trị" className="rounded-lg border p-3">{savedRecord.treatment_plan}</Detail><Detail label="Lời dặn" className="rounded-lg border p-3">{savedRecord.advice}</Detail><Detail label="Ngày tái khám" className="rounded-lg border p-3">{dateLabel(savedRecord.follow_up_date)}</Detail><Detail label="Hướng dẫn tái khám" className="rounded-lg border p-3">{savedRecord.follow_up_notes}</Detail></section>
      <section><h3 className="mb-3 font-semibold text-slate-800">Đơn thuốc</h3>{savedRecord.prescriptions?.length ? <div className="overflow-x-auto rounded-lg border"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="p-3">Thuốc</th><th className="p-3">Số lượng</th><th className="p-3">Liều dùng</th><th className="p-3">Số ngày</th><th className="p-3">Bữa ăn</th><th className="p-3">Hướng dẫn</th></tr></thead><tbody className="divide-y">{savedRecord.prescriptions.map((item) => <tr key={item.prescription_id} className="align-top"><td className="p-3"><div className="font-medium">{item.medicine_name}</div><div className="text-xs text-slate-600">{item.dispensing_source === 'EXTERNAL' ? 'Bệnh nhân tự mua ngoài · không tính vào hóa đơn phòng khám' : item.dispensing_source === 'CLINIC' ? 'Phòng khám cấp' : 'Nguồn cấp chưa ghi nhận (đơn cũ)'}</div>{item.medicine_generic_name && <div className="text-xs text-slate-500">{item.medicine_generic_name}</div>}{item.medicine_packing && <div className="text-xs text-slate-500">Quy cách: {item.medicine_packing}</div>}</td><td className="p-3">{missing(item.quantity)} {item.unit_name || ''}</td><td className="p-3">{missing(item.dosage)}{item.frequency ? <div className="mt-1 text-xs text-slate-500">Tần suất cũ: {item.frequency}</div> : null}{item.dosage_times?.length ? <div className="mt-1 text-xs text-slate-500">Thời điểm cũ: {item.dosage_times.map((time) => time.name).join(', ')}</div> : null}</td><td className="p-3">{missing(item.duration)}{item.duration ? ' ngày' : ''}</td><td className="p-3">{mealLabel(item.meal_name)}</td><td className="p-3">{missing(item.instructions)}</td></tr>)}</tbody></table></div> : <p className="rounded-lg bg-slate-50 p-4 text-slate-600">Không kê thuốc.</p>}</section>
    </section>}

    <form onSubmit={save} className="space-y-5">
      {!savedRecord && <fieldset className="contents">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold">Sinh hiệu</h2>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[['height','Chiều cao (cm)'],['weight','Cân nặng (kg)'],['blood_pressure','Huyết áp (mmHg)'],['temperature','Nhiệt độ (°C)'],['heart_rate','Nhịp tim (lần/phút)'],['spo2','SpO₂ (%)']].map(([key,label])=><label key={key} className="space-y-1 text-sm"><span>{label}</span><input inputMode={key === 'blood_pressure' ? 'text' : 'decimal'} type="text" value={vitals[key]} onChange={(event)=>updateVital(key,event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>)}</div>
          {vitalIssues.length > 0 && <div className={`mt-3 rounded-lg p-3 text-sm ${hasHardVitalError ? 'border border-rose-200 bg-rose-50 text-rose-800' : 'border border-amber-200 bg-amber-50 text-amber-900'}`}><p className="font-medium">Kiểm tra sinh hiệu</p><ul className="mt-1 list-inside list-disc">{vitalIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>{!hasHardVitalError && <label className="mt-2 flex items-start gap-2"><input type="checkbox" checked={vitalsAcknowledged} onChange={(event)=>setVitalsAcknowledged(event.target.checked)} className="mt-1" />Tôi đã kiểm tra lại số liệu nhập.</label>}</div>}
          <p className="mt-2 text-xs text-slate-500">Cảnh báo chỉ kiểm tra định dạng và giá trị nhập liệu rộng, không tự sửa số liệu hoặc áp ngưỡng theo tuổi.</p>
          <label className="mt-4 block space-y-1 text-sm"><span>Triệu chứng và diễn biến</span><textarea value={form.symptoms} onChange={(event)=>updateForm('symptoms',event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold">Chẩn đoán và kế hoạch</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span>Chẩn đoán ban đầu</span><input value={form.initial_diagnosis} onChange={(event)=>updateForm('initial_diagnosis',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="space-y-1 text-sm"><span>Chẩn đoán cuối cùng *</span><input required value={form.final_diagnosis} onChange={(event)=>updateForm('final_diagnosis',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <div className="space-y-2 text-sm sm:col-span-2"><label htmlFor="icd10-search">Tìm mã ICD-10 theo mã hoặc tên bệnh (có thể để trống)</label><input id="icd10-search" value={icdSearch} onChange={(event)=>setIcdSearch(event.target.value)} placeholder="Ví dụ: I10 hoặc hypertension" className="w-full rounded-lg border border-slate-300 px-3 py-2" /><select value={form.icd10_code} onChange={(event)=>updateForm('icd10_code',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Không chọn mã ICD-10</option>{form.icd10_code && !catalog.icd10_codes.some((item)=>item.code === form.icd10_code) && <option value={form.icd10_code}>{form.icd10_code} · Mã đang lưu, chưa có trong danh mục</option>}{filteredIcdCodes.map((item)=><option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select>{catalog.icd10_codes.length === 0 && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">Danh mục ICD-10 hiện chưa có mã. Không có mã nào được suy đoán hoặc tự chọn; quản trị viên cần nạp danh mục ICD-10 đáng tin cậy.</p>}</div>
            <label className="space-y-1 text-sm sm:col-span-2"><span>Kế hoạch điều trị</span><textarea value={form.treatment_plan} onChange={(event)=>updateForm('treatment_plan',event.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="space-y-1 text-sm sm:col-span-2"><span>Lời dặn</span><textarea value={form.advice} onChange={(event)=>updateForm('advice',event.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Đơn thuốc</h2><button type="button" onClick={addPrescription} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"><Plus className="h-4 w-4" /> Thêm thuốc</button></div>
          {prescriptions.length === 0 && <p className="text-sm text-slate-600">Chưa thêm thuốc. Kê thuốc cần chọn danh mục thật.</p>}
          {prescriptions.map((item,index)=><div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm lg:col-span-2"><span>Thuốc *</span><select required value={item.medicine_id} onChange={(event)=>updatePrescription(index,'medicine_id',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Chọn thuốc</option>{catalog.drugs.map((drug)=><option key={drug.drug_id} value={drug.drug_id}>{drug.name} · {drug.is_active ? (Number(drug.price) > 0 ? `${Number(drug.price).toLocaleString('vi-VN')} ₫` : 'Chưa cập nhật giá') : 'Đã ngừng kinh doanh · chỉ kê mua ngoài'} · dùng được {Number(drug.available_quantity || 0)}</option>)}</select></label>
            {item.medicine_id && <div className="space-y-2 text-sm sm:col-span-2 lg:col-span-4">
              {(() => { const drug = catalog.drugs.find((row) => Number(row.drug_id) === Number(item.medicine_id)); const available = Number(drug?.available_quantity || 0); const clinicAllowed = Boolean(drug?.is_active) && Number(drug?.price) > 0 && available >= Number(item.quantity); return <>
                <p className={clinicAllowed ? 'text-emerald-700' : 'text-amber-800'}>{drug?.name}: phòng khám có thể cấp {available} đơn vị còn hạn. {!drug?.is_active ? 'Thuốc đã ngừng kinh doanh.' : Number(drug?.price) <= 0 ? 'Chưa có giá bán hợp lệ.' : available < Number(item.quantity) ? `Đơn cần ${item.quantity}; thiếu ${Number(item.quantity) - available}.` : ''}</p>
                <div className="flex flex-wrap gap-4 rounded-lg bg-slate-50 p-3">
                  <label className="inline-flex items-center gap-2"><input type="radio" name={`source-${index}`} checked={item.dispensing_source === 'CLINIC'} disabled={!clinicAllowed} onChange={() => updatePrescription(index, 'dispensing_source', 'CLINIC')} />Phòng khám cấp và tính vào hóa đơn</label>
                  <label className="inline-flex items-center gap-2"><input type="radio" name={`source-${index}`} checked={item.dispensing_source === 'EXTERNAL'} onChange={() => updatePrescription(index, 'dispensing_source', 'EXTERNAL')} />Bệnh nhân tự mua ngoài, không tính vào hóa đơn phòng khám</label>
                </div>
              </>; })()}
            </div>}
            <label className="space-y-1 text-sm"><span>Số lượng trong đơn</span><input required type="number" min="1" value={item.quantity} onChange={(event)=>updatePrescription(index,'quantity',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="space-y-1 text-sm"><span>Số ngày</span><input required type="number" min="1" max="365" value={item.duration_days} onChange={(event)=>updatePrescription(index,'duration_days',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="space-y-1 text-sm lg:col-span-2"><span>Liều dùng</span><input required value={item.dosage} onChange={(event)=>updatePrescription(index,'dosage',event.target.value)} placeholder="Sáng 1 viên, tối 1 viên" className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="space-y-1 text-sm"><span>Quan hệ bữa ăn</span><select value={item.meal_relation_id} onChange={(event)=>updatePrescription(index,'meal_relation_id',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Không chỉ định</option>{catalog.meal_relations.map((relation)=><option key={relation.relation_id} value={relation.relation_id}>{relation.name === 'Trong khi ăn' ? 'Trong bữa ăn' : relation.name}</option>)}</select></label>
            <label className="space-y-1 text-sm lg:col-span-3"><span>Hướng dẫn thêm</span><input value={item.usage_instruction} onChange={(event)=>updatePrescription(index,'usage_instruction',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <div className="flex items-end justify-end lg:col-span-4"><button type="button" onClick={()=>removePrescription(index)} className="inline-flex items-center gap-1 text-sm text-rose-700"><Trash2 className="h-4 w-4"/> Xóa thuốc</button></div>
          </div>)}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-3 text-sm font-semibold">Tái khám</h2><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Ngày tái khám (nếu cần)</span><input type="date" value={form.follow_up_date} onChange={(event)=>updateForm('follow_up_date',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="space-y-1 text-sm"><span>Hướng dẫn</span><input value={form.follow_up_notes} onChange={(event)=>updateForm('follow_up_notes',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label></div></section>
        <div className="flex justify-end"><button disabled={saving || hasHardVitalError || (vitalIssues.length > 0 && !vitalsAcknowledged)} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-5 py-3 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"><Save className="h-4 w-4"/>{saving?'Đang lưu…':'Hoàn tất khám và lưu bệnh án'}</button></div>
      </fieldset>}
      {savedRecord?.patient_name && <article id="print-document" className="hidden print:block"><h1 className="text-center text-lg font-bold">PHIẾU KHÁM BỆNH</h1><p>Bệnh nhân: {savedRecord.patient_name} · Ngày khám: {dateLabel(savedRecord.appointment_date)}</p><p>Bác sĩ: {savedRecord.doctor_name} · Dịch vụ: {appointment.service_name || 'Khám'} · Phòng: {appointment.room_name || appointment.room_number || 'Chưa ghi nhận'}</p><h2>Sinh hiệu</h2>{savedVitals.map(([label,value,unit])=><p key={label}>{label}: {missing(value)}{value !== null && value !== undefined && value !== '' ? ` ${unit}` : ''}</p>)}<h2>Khám và chẩn đoán</h2><p>Triệu chứng: {missing(savedRecord.symptoms)}</p><p>Chẩn đoán ban đầu: {missing(savedRecord.initial_diagnosis)}</p><p>Chẩn đoán cuối: {missing(savedRecord.final_diagnosis)}</p><p>ICD-10: {savedRecord.icd10_code ? `${savedRecord.icd10_code} · ${savedRecord.icd10_description || 'Chưa có tên trong danh mục hiện tại'}` : 'Không chỉ định'}</p><p>Kế hoạch điều trị: {missing(savedRecord.treatment_plan)}</p><p>Lời dặn: {missing(savedRecord.advice)}</p><h2>Đơn thuốc</h2>{savedRecord.prescriptions?.map((item)=><p key={item.prescription_id}>{item.medicine_name} · {item.quantity} {item.unit_name || ''} · {item.dosage} · {item.duration} ngày · {mealLabel(item.meal_name)} · {item.instructions || 'Chưa ghi nhận'}</p>)}<p>Tái khám: {dateLabel(savedRecord.follow_up_date)} · {savedRecord.follow_up_notes || 'Chưa ghi nhận'}</p><div className="mt-12 flex justify-end">Bác sĩ ký tên</div><style>{'@media print{body *{visibility:hidden}#print-document,#print-document *{visibility:visible}#print-document{position:fixed;inset:0;display:block!important;overflow:auto;background:#fff;padding:24px}}'}</style></article>}
    </form>
  </div>;
};

export default ExaminationPrescription;
