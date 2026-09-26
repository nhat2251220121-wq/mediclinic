import React, { useState } from 'react';
import { Stethoscope, User, Calendar, Clock, Pill, Plus, Trash2, Printer, CheckCircle, FileText, Activity, AlertCircle, X } from 'lucide-react';

const mockTodayPatients = [
  {
    id: 1,
    fullName: 'Nguyễn Văn Nghĩa',
    dob: '20/05/1990',
    gender: 'Nam',
    phone: '0912325678',
    insuranceCode: 'INS987654',
    emergencyContact: '0987654521',
    job: 'Kinh doanh',
    address: '123 Nguyễn Trãi, Quận 1, TP.HCM',
    serviceName: 'Khám Nội tổng quát',
    room: 'Phòng Khám Nhi - Tầng 1 - Phòng 102',
    date: '03/11/2025',
    time: '11:00:00',
    status: 'WAITING'
  },
  {
    id: 2,
    fullName: 'Nguyễn Văn An',
    dob: '12/05/1985',
    gender: 'Nam',
    phone: '0912345678',
    insuranceCode: 'BHYT123456',
    emergencyContact: '0912345679',
    job: 'Nhân viên văn phòng',
    address: 'Hà Nội',
    serviceName: 'Khám Tim mạch',
    room: 'Phòng Tim Mạch - P.101',
    date: '03/11/2025',
    time: '14:00:00',
    status: 'WAITING'
  }
];

const icd10List = [
  { code: 'A00.0', desc: 'Dịch tả do Vibrio cholerae 01, biovar cholerae' },
  { code: 'A01.1', desc: 'Paratyphoid fever A' },
  { code: 'J02.9', desc: 'Viêm họng cấp không xác định' },
  { code: 'G43.0', desc: 'Migraine không có triệu chứng báo trước' },
  { code: 'I10', desc: 'Tăng huyết áp vô căn (nguyên phát)' },
  { code: 'L23', desc: 'Viêm da tiếp xúc dị ứng' }
];

const defaultMedicines = [
  { id: 1, name: 'Paracetamol 500mg', unit: 'Viên', defaultDosage: '1 Viên', time: 'Sáng, Tối', meal: 'Sau ăn', duration: 5, instruction: 'Uống sau khi ăn no' },
  { id: 2, name: 'Vitamin B1 - B6 - B12', unit: 'Viên', defaultDosage: '2 Viên', time: 'Chiều, Trưa, Sáng', meal: 'Sau ăn', duration: 10, instruction: 'Uống nhiều nước' },
  { id: 3, name: 'Magnesium-B6', unit: 'Viên', defaultDosage: '1 Viên', time: 'Sau ăn', meal: 'Uống sau bữa ăn tối', duration: 7, instruction: 'Giúp giảm căng thẳng' },
  { id: 4, name: 'Amoxicillin 500mg', unit: 'Viên', defaultDosage: '1 Viên', time: 'Sáng, Tối', meal: 'Sau ăn', duration: 7, instruction: 'Kháng sinh chống nhiễm trùng' },
];

const ExaminationPrescription = () => {
  const [patients] = useState(mockTodayPatients);
  const [selectedPatient, setSelectedPatient] = useState(mockTodayPatients[0]);

  // Form khám bệnh (Hình 3.8)
  const [symptoms, setSymptoms] = useState('Đau đầu, chóng mặt');
  const [initialDiagnosis, setInitialDiagnosis] = useState('Căng thẳng dẫn đến mất ngủ');
  const [finalDiagnosis, setFinalDiagnosis] = useState('Mất ngủ do căng thẳng');
  const [selectedIcd, setSelectedIcd] = useState('A01.1');
  const [treatmentPlan, setTreatmentPlan] = useState('Thư giãn, uống thuốc');
  const [notes, setNotes] = useState('Bệnh nhân đáp ứng tốt với liệu trình điều trị ban đầu.');

  // Chỉ số sinh hiệu (Hình 3.8 & 3.10)
  const [vitals, setVitals] = useState({
    height: 168,
    weight: 58,
    bloodPressure: '120.5',
    temperature: 38.0,
    heartRate: 58,
    spo2: 95
  });

  // Tái khám
  const [hasFollowUp, setHasFollowUp] = useState(true);
  const [followUpDate, setFollowUpDate] = useState('2025-11-17');
  const [followUpNotes, setFollowUpNotes] = useState('Tái khám mắt ngủ');

  // Đơn thuốc (Hình 3.8 & 3.10)
  const [prescriptions, setPrescriptions] = useState([
    {
      drugName: 'Vitamin B1 - B6 - B12',
      dosage: '2 Viên / lần',
      unit: 'Viên',
      duration: 10,
      time: 'Chiều, Trưa, Sáng',
      meal: 'Sau ăn',
      instruction: 'Uống nhiều nước'
    }
  ]);

  // Modal in phiếu kết quả khám (Hình 3.10)
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Thêm thuốc
  const handleAddDrug = (drug) => {
    setPrescriptions([
      ...prescriptions,
      {
        drugName: drug.name,
        dosage: drug.defaultDosage,
        unit: drug.unit,
        duration: drug.duration,
        time: drug.time,
        meal: drug.meal,
        instruction: drug.instruction
      }
    ]);
  };

  const handleRemoveDrug = (index) => {
    const updated = [...prescriptions];
    updated.splice(index, 1);
    setPrescriptions(updated);
  };

  const handleSaveExam = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 font-sans">
      {/* ======================================================== */}
      {/* CỘT TRÁI: DANH SÁCH BỆNH NHÂN CHỜ KHÁM (HÌNH 3.8)         */}
      {/* ======================================================== */}
      <div className="w-full lg:w-72 bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex-shrink-0 space-y-4">
        <div>
          <span className="text-xs font-bold text-sky-700 uppercase tracking-wider block">Bệnh nhân hôm nay</span>
          <span className="text-[11px] text-slate-400">Chọn bệnh nhân để tiến hành khám</span>
        </div>

        <div className="space-y-2">
          {patients.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedPatient(p)}
              className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition ${
                selectedPatient.id === p.id
                  ? 'bg-sky-50 border-sky-400 text-sky-900 font-bold shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">{p.fullName}</span>
                <span className="text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full font-bold">
                  {p.time}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">{p.serviceName}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* VÙNG CHÍNH: FORM KHÁM BỆNH & KÊ ĐƠN THUỐC (HÌNH 3.8)      */}
      {/* ======================================================== */}
      <div className="flex-1 space-y-6">
        {/* Header buổi khám & Action Buttons */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-sky-600 uppercase">Khám mới</span>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              Bệnh nhân: <span className="text-sky-700">{selectedPatient.fullName}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Xuất file PDF phiếu khám</span>
            </button>
            <button
              onClick={handleSaveExam}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-sky-600/30 flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Lưu kết quả khám</span>
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-2 text-xs font-bold">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>Đã lưu kết quả khám bệnh và toa thuốc thành công vào hệ thống!</span>
          </div>
        )}

        {/* Thông tin bệnh nhân & Thông tin dịch vụ (Hình 3.8) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">Thông tin bệnh nhân</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Họ tên:</span>
              <strong className="text-slate-800">{selectedPatient.fullName}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Ngày sinh:</span>
              <strong className="text-slate-800">{selectedPatient.dob}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Giới tính:</span>
              <strong className="text-slate-800">{selectedPatient.gender}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Số điện thoại:</span>
              <strong className="text-slate-800">{selectedPatient.phone}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Mã BHYT:</span>
              <strong className="text-slate-800">{selectedPatient.insuranceCode}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Người liên hệ:</span>
              <strong className="text-slate-800">{selectedPatient.emergencyContact}</strong>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 block text-[11px]">Địa chỉ:</span>
              <strong className="text-slate-800">{selectedPatient.address}</strong>
            </div>
          </div>

          <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100 text-xs">
            <span className="font-bold text-teal-800 block mb-1">Thông tin dịch vụ khám:</span>
            <div className="text-slate-700">Tên dịch vụ: <strong>{selectedPatient.serviceName}</strong> | {selectedPatient.room}</div>
            <div className="text-slate-500 mt-0.5">Ngày khám: {selectedPatient.date} - Giờ khám: {selectedPatient.time}</div>
          </div>
        </div>

        {/* Khối Khám bệnh lâm sàng & Sinh hiệu (Hình 3.8) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">Khám bệnh lâm sàng</span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-600 block mb-1">* Triệu chứng ban đầu</label>
              <input
                type="text"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-600 block mb-1">* Chẩn đoán ban đầu</label>
              <input
                type="text"
                value={initialDiagnosis}
                onChange={(e) => setInitialDiagnosis(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {/* 6 Chỉ số sinh hiệu (Hình 3.8) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Chiều cao (cm)</label>
              <input
                type="number"
                value={vitals.height}
                onChange={(e) => setVitals({ ...vitals, height: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Cân nặng (kg)</label>
              <input
                type="number"
                value={vitals.weight}
                onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Huyết áp (mmHg)</label>
              <input
                type="text"
                value={vitals.bloodPressure}
                onChange={(e) => setVitals({ ...vitals, bloodPressure: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nhiệt độ (°C)</label>
              <input
                type="number"
                step="0.1"
                value={vitals.temperature}
                onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nhịp tim (lần/phút)</label>
              <input
                type="number"
                value={vitals.heartRate}
                onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">SpO2 (%)</label>
              <input
                type="number"
                value={vitals.spo2}
                onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
            <div>
              <label className="font-semibold text-slate-600 block mb-1">* Chẩn đoán cuối cùng</label>
              <input
                type="text"
                value={finalDiagnosis}
                onChange={(e) => setFinalDiagnosis(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-600 block mb-1">* Mã ICD-10</label>
              <select
                value={selectedIcd}
                onChange={(e) => setSelectedIcd(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                {icd10List.map(item => (
                  <option key={item.code} value={item.code}>{item.code} - {item.desc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tái khám (Hình 3.8) */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={hasFollowUp}
                onChange={(e) => setHasFollowUp(e.target.checked)}
                className="rounded text-sky-600"
              />
              <span>Hẹn tái khám</span>
            </label>

            {hasFollowUp && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Ngày tái khám</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Ghi chú tái khám</label>
                  <input
                    type="text"
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Kê đơn thuốc (Hình 3.8) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">Kê đơn thuốc</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Chọn thêm nhanh:</span>
              {defaultMedicines.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleAddDrug(m)}
                  className="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-bold transition border border-sky-100"
                >
                  + {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="p-3">Thuốc</th>
                  <th className="p-3">Liều dùng</th>
                  <th className="p-3">Đơn vị</th>
                  <th className="p-3">Số ngày</th>
                  <th className="p-3">Thời gian uống</th>
                  <th className="p-3">So với bữa ăn</th>
                  <th className="p-3">Hướng dẫn thêm</th>
                  <th className="p-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prescriptions.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-bold text-slate-800">{p.drugName}</td>
                    <td className="p-3">{p.dosage}</td>
                    <td className="p-3">{p.unit}</td>
                    <td className="p-3">{p.duration}</td>
                    <td className="p-3">{p.time}</td>
                    <td className="p-3">{p.meal}</td>
                    <td className="p-3 text-slate-500">{p.instruction}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveDrug(idx)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL XUẤT PHIẾU KẾT QUẢ KHÁM BỆNH CHUẨN IN (HÌNH 3.10)   */}
      {/* ======================================================== */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPrintModal(false)}></div>
          <div className="relative bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 z-10 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Thanh công cụ in */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 no-print">
              <span className="text-xs font-bold text-slate-400 uppercase">Xem trước bản in (Print Preview)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>In phiếu ngay</span>
                </button>
                <button onClick={() => setShowPrintModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* MẪU PHIẾU KHÁM BỆNH Y HỆT HÌNH 3.10 */}
            <div className="space-y-6 text-slate-800 text-xs">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-black uppercase tracking-wider text-slate-900">
                  PHIẾU KẾT QUẢ KHÁM BỆNH
                </h2>
                <div className="text-xs text-slate-600">Dịch vụ khám: <strong>{selectedPatient.serviceName}</strong></div>
                <div className="text-xs text-slate-500">Phòng khám: {selectedPatient.room}</div>
              </div>

              {/* I. THÔNG TIN BỆNH NHÂN */}
              <div className="space-y-2">
                <div className="font-bold uppercase text-[11px] text-sky-800 border-b border-slate-200 pb-1">
                  I. THÔNG TIN BỆNH NHÂN
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Họ tên: <strong>{selectedPatient.fullName}</strong></div>
                  <div>Giới tính: <strong>{selectedPatient.gender}</strong></div>
                  <div>Ngày sinh: <strong>{selectedPatient.dob}</strong></div>
                  <div>SĐT: <strong>{selectedPatient.phone}</strong></div>
                  <div>Địa chỉ: <strong>{selectedPatient.address}</strong></div>
                  <div>Mã BHYT: <strong>{selectedPatient.insuranceCode}</strong></div>
                </div>
              </div>

              {/* II. KẾT QUẢ KHÁM LÂM SÀNG */}
              <div className="space-y-2">
                <div className="font-bold uppercase text-[11px] text-sky-800 border-b border-slate-200 pb-1">
                  II. KẾT QUẢ KHÁM LÂM SÀNG
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Chiều cao (cm): <strong>{vitals.height}</strong></div>
                  <div>Cân nặng (kg): <strong>{vitals.weight}</strong></div>
                  <div>Huyết áp (mmHg): <strong>{vitals.bloodPressure}</strong></div>
                  <div>Nhiệt độ (°C): <strong>{vitals.temperature}</strong></div>
                  <div>Nhịp tim (lần/phút): <strong>{vitals.heartRate}</strong></div>
                  <div>SpO2 (%): <strong>{vitals.spo2}</strong></div>
                  <div className="col-span-2">Triệu chứng: <strong>{symptoms}</strong></div>
                </div>
              </div>

              {/* III. CHẨN ĐOÁN VÀ KẾ HOẠCH ĐIỀU TRỊ */}
              <div className="space-y-2">
                <div className="font-bold uppercase text-[11px] text-sky-800 border-b border-slate-200 pb-1">
                  III. CHẨN ĐOÁN VÀ KẾ HOẠCH ĐIỀU TRỊ
                </div>
                <div>Chẩn đoán ban đầu: <strong>{initialDiagnosis}</strong></div>
                <div>Chẩn đoán cuối cùng: <strong>{finalDiagnosis}</strong></div>
                <div>Mã ICD-10: <strong>{selectedIcd}</strong></div>
                <div>Kế hoạch điều trị: <strong>{treatmentPlan}</strong></div>
              </div>

              {/* IV. ĐƠN THUỐC */}
              <div className="space-y-2">
                <div className="font-bold uppercase text-[11px] text-sky-800 border-b border-slate-200 pb-1">
                  IV. ĐƠN THUỐC
                </div>
                <table className="w-full text-left border border-slate-200">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="p-2 border">STT</th>
                      <th className="p-2 border">Tên thuốc</th>
                      <th className="p-2 border">Liều dùng</th>
                      <th className="p-2 border">Thời điểm uống</th>
                      <th className="p-2 border">So với bữa ăn</th>
                      <th className="p-2 border">Số ngày</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((p, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 border text-center">{idx + 1}</td>
                        <td className="p-2 border font-bold">{p.drugName}</td>
                        <td className="p-2 border">{p.dosage}</td>
                        <td className="p-2 border">{p.time}</td>
                        <td className="p-2 border">{p.meal}</td>
                        <td className="p-2 border text-center">{p.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* V. HẸN TÁI KHÁM */}
              {hasFollowUp && (
                <div className="space-y-1">
                  <div className="font-bold uppercase text-[11px] text-sky-800 border-b border-slate-200 pb-1">
                    V. HẸN TÁI KHÁM
                  </div>
                  <div>Ngày tái khám: <strong>{followUpDate}</strong></div>
                  <div>Ghi chú: {followUpNotes}</div>
                </div>
              )}

              {/* Chữ ký bác sĩ */}
              <div className="pt-6 flex justify-end text-right">
                <div className="space-y-8 pr-4">
                  <div>TP. Hồ Chí Minh, ngày 03 tháng 11 năm 2025</div>
                  <div className="font-bold">Bác sĩ khám: BS. Đào Phan Quốc Hoài</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExaminationPrescription;
