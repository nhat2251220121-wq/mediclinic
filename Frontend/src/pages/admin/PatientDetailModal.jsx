import React, { useEffect, useState } from 'react';
import { Activity, CalendarDays, ClipboardList, FileText, Pill, UserRound, X } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const missing = (value) => value === null || value === undefined || String(value).trim() === '' ? 'Chưa cập nhật' : value;
const clinicalMissing = (value) => value === null || value === undefined || String(value).trim() === '' ? 'Chưa ghi nhận' : value;
const formatDate = (value) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleDateString('vi-VN');
};
const formatGender = (value) => ({ MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' }[value] || 'Chưa cập nhật');

const InfoItem = ({ label, value }) => (
  <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
    <div className="mt-1 break-words text-sm font-medium text-slate-800">{missing(value)}</div>
  </div>
);

const RecordSection = ({ title, children, icon: Icon }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
      <Icon className="h-4 w-4 text-sky-600" />{title}
    </h4>
    {children}
  </section>
);

const PatientDetailModal = ({ patient, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [activeRecordId, setActiveRecordId] = useState('');
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recordLoading, setRecordLoading] = useState(false);
  const [error, setError] = useState('');
  const [recordError, setRecordError] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setDetail(null);
    setRecord(null);
    setActiveRecordId('');
    setError('');
    axiosClient.get(`/admin/patients/${patient.id}/details`)
      .then((response) => {
        if (!current) return;
        setDetail(response.data);
        setActiveRecordId(response.data?.visits?.[0]?.record_id || '');
      })
      .catch((requestError) => {
        if (current) setError(requestError.message || 'Không tải được hồ sơ bệnh nhân.');
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [patient.id]);

  useEffect(() => {
    if (!activeRecordId) {
      setRecord(null);
      setRecordError('');
      return undefined;
    }
    let current = true;
    setRecord(null);
    setRecordError('');
    setRecordLoading(true);
    axiosClient.get(`/admin/patients/${patient.id}/medical-records/${activeRecordId}`)
      .then((response) => { if (current) setRecord(response.data); })
      .catch((requestError) => { if (current) setRecordError(requestError.message || 'Không tải được bệnh án của lần khám này.'); })
      .finally(() => { if (current) setRecordLoading(false); });
    return () => { current = false; };
  }, [patient.id, activeRecordId]);

  const visits = detail?.visits || [];
  const prescriptions = record?.prescriptions || [];
  const displayText = (value) => clinicalMissing(value);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="patient-detail-title">
      <button className="fixed inset-0 bg-slate-950/60" onClick={onClose} aria-label="Đóng chi tiết bệnh nhân" />
      <div className="relative z-10 flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-sky-700">Hồ sơ bệnh nhân</div>
            <h2 id="patient-detail-title" className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{patient.full_name || `Bệnh nhân #${patient.id}`}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X className="h-5 w-5" /></button>
        </header>

        <div className="overflow-y-auto p-3 sm:p-6">
          {loading ? <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Đang tải hồ sơ và lịch sử khám...</div> : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900"><UserRound className="h-5 w-5 text-sky-600" />Thông tin bệnh nhân</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem label="Họ và tên" value={detail?.patient?.full_name} />
                <InfoItem label="Ngày sinh" value={formatDate(detail?.patient?.date_of_birth)} />
                <InfoItem label="Giới tính" value={formatGender(detail?.patient?.gender)} />
                <InfoItem label="Mã BHYT" value={detail?.patient?.insurance_code} />
                <InfoItem label="Số điện thoại" value={detail?.patient?.phone} />
                <InfoItem label="Liên hệ khẩn cấp" value={detail?.patient?.emergency_contact} />
                <InfoItem label="Nghề nghiệp" value={detail?.patient?.job} />
                <InfoItem label="Địa chỉ" value={detail?.patient?.address} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><CalendarDays className="h-5 w-5 text-sky-600" />Lịch sử khám bệnh</h3>
                {visits.length > 0 && <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <span>Chọn lần khám</span>
                  <select value={activeRecordId} onChange={(event) => setActiveRecordId(event.target.value)} className="max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    {visits.map((visit) => <option key={visit.record_id} value={visit.record_id}>
                      {formatDate(visit.appointment_date)} · {visit.doctor_name || 'Chưa cập nhật bác sĩ'} · {visit.service_name || 'Chưa cập nhật dịch vụ'}
                    </option>)}
                  </select>
                </label>}
              </div>
              {!visits.length ? <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Chưa có lịch sử khám</div> : recordLoading ? (
                <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Đang tải bệnh án...</div>
              ) : recordError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{recordError}</div> : record && <div className="space-y-4">
                <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-950">
                  <span><strong>Ngày khám:</strong> {formatDate(record.appointment_date)} {record.time_slot || ''}</span>
                  <span><strong>Bác sĩ:</strong> {missing(record.doctor_name)}</span>
                  <span><strong>Dịch vụ:</strong> {missing(record.service_name)}</span>
                </div>

                <RecordSection title="Sinh hiệu" icon={Activity}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <InfoItem label="Chiều cao" value={record.height == null ? null : `${record.height} cm`} />
                    <InfoItem label="Cân nặng" value={record.weight == null ? null : `${record.weight} kg`} />
                    <InfoItem label="Huyết áp" value={record.blood_pressure == null ? null : `${record.blood_pressure} mmHg`} />
                    <InfoItem label="Nhiệt độ" value={record.temperature == null ? null : `${record.temperature} °C`} />
                    <InfoItem label="Nhịp tim" value={record.heart_rate == null ? null : `${record.heart_rate} lần/phút`} />
                    <InfoItem label="SpO₂" value={record.spo2 == null ? null : `${record.spo2} %`} />
                  </div>
                </RecordSection>

                <RecordSection title="Triệu chứng và diễn biến" icon={ClipboardList}><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{displayText(record.symptoms)}</p></RecordSection>
                <div className="grid gap-4 lg:grid-cols-2">
                  <RecordSection title="Chẩn đoán ban đầu" icon={FileText}><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{displayText(record.initial_diagnosis)}</p></RecordSection>
                  <RecordSection title="Chẩn đoán cuối cùng" icon={FileText}><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{displayText(record.final_diagnosis)}</p></RecordSection>
                </div>
                <RecordSection title="Mã ICD-10" icon={FileText}><p className="text-sm text-slate-700">{record.icd10_code ? <><strong>{record.icd10_code}</strong> · {missing(record.icd10_description)}</> : 'Chưa ghi nhận'}</p></RecordSection>
                <RecordSection title="Kế hoạch điều trị" icon={ClipboardList}><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{displayText(record.treatment_plan)}</p></RecordSection>
                <div className="grid gap-4 lg:grid-cols-2">
                  <RecordSection title="Ghi chú" icon={FileText}><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{displayText(record.notes)}</p></RecordSection>
                  <RecordSection title="Lời dặn và tái khám" icon={CalendarDays}>
                    <p className="text-sm text-slate-700">Ngày tái khám: {formatDate(record.follow_up_date)}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{displayText(record.advice || record.follow_up_instruction)}</p>
                  </RecordSection>
                </div>

                <RecordSection title="Đơn thuốc" icon={Pill}>
                  {prescriptions.length === 0 ? <p className="text-sm text-slate-500">Không có đơn thuốc trong lần khám này.</p> : <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead><tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500"><th className="px-3 py-2">Thuốc</th><th className="px-3 py-2">Liều dùng</th><th className="px-3 py-2">Số lượng</th><th className="px-3 py-2">Số ngày</th><th className="px-3 py-2">Thời gian uống</th><th className="px-3 py-2">Quan hệ bữa ăn</th><th className="px-3 py-2">Hướng dẫn thêm</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{prescriptions.map((item) => <tr key={item.prescription_id} className="align-top text-slate-700">
                        <td className="px-3 py-3 font-semibold text-slate-900">{missing(item.medicine_name)}{item.medicine_packing ? <span className="block font-normal text-slate-500">{item.medicine_packing}</span> : null}</td>
                        <td className="px-3 py-3">{missing(item.dosage)}</td>
                        <td className="px-3 py-3">{missing(item.quantity)} {item.unit_name || ''}</td>
                        <td className="px-3 py-3">{item.duration == null ? 'Chưa cập nhật' : item.duration}</td>
                        <td className="px-3 py-3">{missing(item.dosage_times)}</td>
                        <td className="px-3 py-3">{missing(item.meal_name)}</td>
                        <td className="px-3 py-3 whitespace-pre-wrap">{missing(item.instructions)}</td>
                      </tr>)}</tbody>
                    </table>
                  </div>}
                </RecordSection>
              </div>}
            </section>
          </div>}
        </div>
      </div>
    </div>
  );
};

export default PatientDetailModal;
