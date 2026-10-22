import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { ArrowLeft, Plus, Printer, Save, Trash2 } from 'lucide-react';

const blankVitals = { height: '', weight: '', blood_pressure: '', temperature: '', heart_rate: '', spo2: '' };
const ExaminationPrescription = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointmentId');
  const [appointment, setAppointment] = useState(null);
  const [history, setHistory] = useState([]);
  const [catalog, setCatalog] = useState({ drugs: [], units: [], dosage_times: [], meal_relations: [], icd10_codes: [] });
  const [vitals, setVitals] = useState(blankVitals);
  const [form, setForm] = useState({ symptoms: '', initial_diagnosis: '', final_diagnosis: '', icd10_code: '', treatment_plan: '', advice: '', follow_up_date: '', follow_up_notes: '' });
  const [prescriptions, setPrescriptions] = useState([]);
  const [savedRecord, setSavedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');

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
  const addPrescription = () => setPrescriptions((current) => [...current, { medicine_id: '', quantity: 1, dosage: '', frequency: '', duration_days: 1, time_ids: [], meal_relation_id: '', usage_instruction: '' }]);
  const updatePrescription = (index, key, value) => setPrescriptions((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const removePrescription = (index) => setPrescriptions((current) => current.filter((_, i) => i !== index));

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const response = await axiosClient.post('/medical-records', {
        appointment_id: Number(appointmentId), ...vitals, ...form,
        prescriptions: prescriptions.map((item) => ({ ...item, medicine_id: Number(item.medicine_id), quantity: Number(item.quantity), duration_days: Number(item.duration_days), meal_relation_id: item.meal_relation_id ? Number(item.meal_relation_id) : null }))
      });
      setSavedRecord({ id: response.data.record_id, record_id: response.data.record_id });
      setError('');
      await loadSavedRecord(response.data.record_id);
    } catch (requestError) { setError(requestError.message || 'Không thể lưu bệnh án.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Đang tải lịch khám…</div>;
  if (!appointment) return <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-700">Chưa chọn lịch hẹn. Hãy mở hồ sơ từ hàng đợi khám để tải đúng bệnh nhân.</p><button onClick={() => navigate('/doctor/queue')} className="text-sm font-medium text-sky-700">Quay lại hàng đợi</button></div>;
  if (appointment.status !== 'CONFIRMED' && !savedRecord) return <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6"><p className="text-sm text-amber-900">{error || 'Lịch này không thể tiếp tục khám.'}</p><button onClick={() => navigate('/doctor/queue')} className="text-sm font-medium text-sky-800">Quay lại hàng đợi</button></div>;

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5">
      <div><button type="button" onClick={() => navigate('/doctor/queue')} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-600"><ArrowLeft className="h-4 w-4" /> Hàng đợi</button>
        <h1 className="text-xl font-semibold text-slate-900">Khám bệnh · Lịch #{appointment.appointment_id}</h1>
      </div>
      {savedRecord?.patient_name && <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"><Printer className="h-4 w-4" /> In phiếu A4</button>}
    </header>

    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {savedRecord && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Bệnh án đã được lưu. Thuốc chỉ được tính vào hóa đơn và trừ kho khi xác nhận cấp.</div>}
      {detailError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{detailError} <button className="ml-2 underline" onClick={() => loadSavedRecord(savedRecord.id)}>Tải lại chi tiết</button></div>}

    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Thông tin bệnh nhân và lịch hẹn</h2>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><span className="text-slate-500">Bệnh nhân</span><p className="font-medium">{appointment.patient_name}</p></div>
        <div><span className="text-slate-500">Điện thoại</span><p className="font-medium">{appointment.patient_phone || '—'}</p></div>
        <div><span className="text-slate-500">Ngày giờ</span><p className="font-medium">{String(appointment.appointment_date).slice(0,10).split('-').reverse().join('/')} · {appointment.time_slot}</p></div>
        <div><span className="text-slate-500">Dịch vụ / phòng</span><p className="font-medium">{appointment.service_name || 'Khám'} · {appointment.room_name || appointment.room_number || '—'}</p></div>
        <div><span className="text-slate-500">Ngày sinh</span><p className="font-medium">{appointment.patient_date_of_birth ? String(appointment.patient_date_of_birth).slice(0,10).split('-').reverse().join('/') : '—'}</p></div>
        <div><span className="text-slate-500">Giới tính</span><p className="font-medium">{appointment.patient_gender || '—'}</p></div>
        <div><span className="text-slate-500">BHYT</span><p className="font-medium">{appointment.patient_insurance_code || '—'}</p></div>
        <div><span className="text-slate-500">Nghề nghiệp</span><p className="font-medium">{appointment.patient_job || '—'}</p></div>
        <div><span className="text-slate-500">Liên hệ khẩn cấp</span><p className="font-medium">{appointment.patient_emergency_contact || '—'}</p></div>
        <div className="sm:col-span-2"><span className="text-slate-500">Địa chỉ</span><p className="font-medium">{appointment.patient_address || '—'}</p></div>
      </div>
    </section>

    {history.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-3 text-sm font-semibold">Bệnh án trước đây</h2><div className="space-y-2">{history.map((record) => <div key={record.record_id} className="rounded-lg bg-slate-50 p-3 text-sm"><strong>{String(record.appointment_date).slice(0,10).split('-').reverse().join('/')}</strong> · {record.doctor_name} · {record.service_name || 'Khám'} · {record.final_diagnosis} <span className="text-slate-500">{record.advice || ''}</span></div>)}</div></section>}

    {savedRecord?.patient_name && <section className="rounded-xl border border-emerald-200 bg-white p-5 text-sm"><h2 className="mb-3 font-semibold">Bệnh án đã lưu · chỉ đọc</h2><p><strong>Chẩn đoán:</strong> {savedRecord.final_diagnosis} · ICD-10 {savedRecord.icd10_code || '—'}</p><p><strong>Triệu chứng:</strong> {savedRecord.symptoms || '—'}</p><p><strong>Sinh hiệu:</strong> {savedRecord.height || '—'} cm · {savedRecord.weight || '—'} kg · HA {savedRecord.blood_pressure || '—'} · {savedRecord.temperature || '—'} °C · nhịp tim {savedRecord.heart_rate || '—'} · SpO₂ {savedRecord.spo2 || '—'}%</p><p><strong>Điều trị:</strong> {savedRecord.treatment_plan || '—'}</p><p><strong>Lời dặn:</strong> {savedRecord.advice || '—'}</p><p><strong>Tái khám:</strong> {savedRecord.follow_up_date ? String(savedRecord.follow_up_date).slice(0,10) : '—'} {savedRecord.follow_up_notes || ''}</p><h3 className="mt-3 font-semibold">Đơn thuốc</h3>{savedRecord.prescriptions?.length ? savedRecord.prescriptions.map((item) => <p key={item.prescription_id}>{item.medicine_name} · {item.quantity} {item.unit_name || ''} · {item.dosage} · {item.frequency} · {item.duration} ngày · {(item.dosage_times || []).map((time) => time.name).join(', ') || 'Không ghi thời điểm'} · {item.meal_name || 'Không ghi bữa ăn'} · {item.instructions || '—'}</p>) : <p>Không kê thuốc.</p>}</section>}

    <form onSubmit={save} className="space-y-5">
      {!savedRecord && <fieldset className="contents">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold">Sinh hiệu</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[['height','Chiều cao (cm)'],['weight','Cân nặng (kg)'],['blood_pressure','Huyết áp'],['temperature','Nhiệt độ (°C)'],['heart_rate','Nhịp tim'],['spo2','SpO₂ (%)']].map(([key,label])=><label key={key} className="space-y-1 text-sm"><span>{label}</span><input type="text" value={vitals[key]} onChange={(event)=>setVitals({...vitals,[key]:event.target.value})} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>)}</div>
        <label className="mt-4 block space-y-1 text-sm"><span>Triệu chứng và diễn biến</span><textarea value={form.symptoms} onChange={(event)=>updateForm('symptoms',event.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold">Chẩn đoán và kế hoạch</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span>Chẩn đoán ban đầu</span><input value={form.initial_diagnosis} onChange={(event)=>updateForm('initial_diagnosis',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Chẩn đoán cuối cùng *</span><input required value={form.final_diagnosis} onChange={(event)=>updateForm('final_diagnosis',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Mã ICD-10</span><select value={form.icd10_code} onChange={(event)=>updateForm('icd10_code',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Chọn mã nếu phù hợp</option>{catalog.icd10_codes.map((item)=><option key={item.code} value={item.code}>{item.code} · {item.description}</option>)}</select></label>
          <label className="space-y-1 text-sm"><span>Kế hoạch điều trị</span><textarea value={form.treatment_plan} onChange={(event)=>updateForm('treatment_plan',event.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="space-y-1 text-sm sm:col-span-2"><span>Lời dặn</span><textarea value={form.advice} onChange={(event)=>updateForm('advice',event.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Đơn thuốc</h2><button type="button" onClick={addPrescription} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"><Plus className="h-4 w-4" /> Thêm thuốc</button></div>
        {prescriptions.length === 0 && <p className="text-sm text-slate-600">Chưa thêm thuốc. Kê thuốc cần chọn danh mục thật.</p>}
        {prescriptions.map((item,index)=><div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm lg:col-span-2"><span>Thuốc *</span><select required value={item.medicine_id} onChange={(event)=>updatePrescription(index,'medicine_id',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Chọn thuốc</option>{catalog.drugs.map((drug)=><option key={drug.drug_id} value={drug.drug_id}>{drug.name} · {Number(drug.price).toLocaleString('vi-VN')} ₫ · tồn {drug.stock_quantity}</option>)}</select></label>
          <label className="space-y-1 text-sm"><span>Số lượng cấp</span><input required type="number" min="1" value={item.quantity} onChange={(event)=>updatePrescription(index,'quantity',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Số ngày</span><input required type="number" min="1" max="365" value={item.duration_days} onChange={(event)=>updatePrescription(index,'duration_days',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Liều dùng</span><input required value={item.dosage} onChange={(event)=>updatePrescription(index,'dosage',event.target.value)} placeholder="Ví dụ: 1 viên/lần" className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Tần suất</span><input required value={item.frequency} onChange={(event)=>updatePrescription(index,'frequency',event.target.value)} placeholder="Ví dụ: 2 lần/ngày" className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="space-y-1 text-sm"><span>Quan hệ bữa ăn</span><select value={item.meal_relation_id} onChange={(event)=>updatePrescription(index,'meal_relation_id',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Không chỉ định</option>{catalog.meal_relations.map((relation)=><option key={relation.relation_id} value={relation.relation_id}>{relation.name}</option>)}</select></label>
          <label className="space-y-1 text-sm lg:col-span-3"><span>Hướng dẫn</span><input value={item.usage_instruction} onChange={(event)=>updatePrescription(index,'usage_instruction',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <div className="flex flex-wrap items-center gap-2 text-xs lg:col-span-4"><span>Thời điểm uống:</span>{catalog.dosage_times.map((time)=>{const checked=item.time_ids.includes(time.time_id);return <label key={time.time_id} className="inline-flex items-center gap-1 rounded-full border px-2 py-1"><input type="checkbox" checked={checked} onChange={()=>updatePrescription(index,'time_ids',checked?item.time_ids.filter((id)=>id!==time.time_id):[...item.time_ids,time.time_id])}/>{time.name}</label>})}<button type="button" onClick={()=>removePrescription(index)} className="ml-auto inline-flex items-center gap-1 text-rose-700"><Trash2 className="h-4 w-4"/> Xóa dòng</button></div>
        </div>)}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-3 text-sm font-semibold">Tái khám</h2><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Ngày tái khám (nếu cần)</span><input type="date" value={form.follow_up_date} onChange={(event)=>updateForm('follow_up_date',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="space-y-1 text-sm"><span>Hướng dẫn</span><input value={form.follow_up_notes} onChange={(event)=>updateForm('follow_up_notes',event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label></div></section>

      {!savedRecord && <div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-5 py-3 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"><Save className="h-4 w-4"/>{saving?'Đang lưu…':'Hoàn tất khám và lưu bệnh án'}</button></div>}
      </fieldset>}
      {savedRecord?.patient_name && <article id="print-document" className="hidden print:block"><h1 className="text-center text-lg font-bold">PHIẾU KHÁM BỆNH</h1><p>Bệnh nhân: {savedRecord.patient_name} · Ngày khám: {String(savedRecord.appointment_date).slice(0,10)}</p><p>Bác sĩ: {savedRecord.doctor_name} · Dịch vụ: {appointment.service_name || 'Khám'} · Phòng: {appointment.room_name || appointment.room_number || '—'}</p><p>Sinh hiệu: cao {savedRecord.height || '—'} cm, nặng {savedRecord.weight || '—'} kg, huyết áp {savedRecord.blood_pressure || '—'}, nhiệt độ {savedRecord.temperature || '—'} °C, nhịp tim {savedRecord.heart_rate || '—'}, SpO₂ {savedRecord.spo2 || '—'}%</p><p>Triệu chứng: {savedRecord.symptoms || '—'}</p><p>Chẩn đoán ban đầu: {savedRecord.initial_diagnosis || '—'}</p><p>Chẩn đoán cuối: {savedRecord.final_diagnosis} · ICD-10: {savedRecord.icd10_code || '—'}</p><p>Điều trị: {savedRecord.treatment_plan || '—'}</p><p>Lời dặn: {savedRecord.advice || '—'}</p><h2>Đơn thuốc</h2>{savedRecord.prescriptions?.map((item)=><p key={item.prescription_id}>{item.medicine_name}: {item.dosage}, {item.frequency}, {item.duration} ngày, cấp {item.quantity} {item.unit_name || ''}. {item.meal_name || ''}. {(item.dosage_times || []).map((time) => time.name).join(', ')}. {item.instructions}</p>)}<p>Tái khám: {savedRecord.follow_up_date ? String(savedRecord.follow_up_date).slice(0,10) : 'Không chỉ định'} · {savedRecord.follow_up_notes || ''}</p><div className="mt-12 flex justify-end">Bác sĩ ký tên</div><style>{'@media print{body *{visibility:hidden}#print-document,#print-document *{visibility:visible}#print-document{position:fixed;inset:0;display:block!important;overflow:auto;background:#fff;padding:24px}}'}</style></article>}
    </form>
  </div>;
};

export default ExaminationPrescription;
