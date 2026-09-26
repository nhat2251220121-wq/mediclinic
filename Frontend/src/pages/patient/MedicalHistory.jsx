import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Eye, Calendar, Clock, Stethoscope, Pill, X, Heart, Activity, FileText } from 'lucide-react';
import AIChatWidget from '../../components/common/AIChatWidget';

const mockHistoryList = [
  {
    id: 'aabce32a-1571-4adf',
    appointmentDate: '15/10/2025',
    timeSlot: '10:30',
    doctorName: 'BS. CKII Nguyễn Văn An',
    specialty: 'Khám Nội tổng quát',
    room: 'Phòng Khám Nội - P.101',
    serviceName: 'Khám Nội tổng quát',
    servicePrice: 300000,
    reExamDate: '17/10/2025',
    status: 'COMPLETE',
    // Chỉ số sinh hiệu (Hình 3.18)
    height: 170,
    weight: 65,
    bloodPressure: '120/80',
    temperature: 36.7,
    heartRate: 75,
    spo2: 98,
    symptoms: 'Đau đầu, chóng mặt, mệt mỏi khi thay đổi thời tiết',
    initialDiagnosis: 'Theo dõi đau nửa đầu Migraine',
    finalDiagnosis: 'Migraine thể điển hình (G43.0)',
    icd10: 'G43.0 - Migraine không có triệu chứng báo trước',
    advice: 'Uống nhiều nước ấm, ngủ đủ 8 tiếng, tránh căng thẳng và làm việc quá sức.',
    prescriptions: [
      {
        drugName: 'Paracetamol 500mg',
        dosage: '1 Viên',
        time: 'Sáng, Tối',
        mealRelation: 'Sau ăn',
        duration: '5 ngày',
        instruction: 'Uống sau khi ăn no cùng với nhiều nước ấm'
      },
      {
        drugName: 'Vitamin B1 - B6 - B12',
        dosage: '2 Viên',
        time: 'Sáng',
        mealRelation: 'Sau ăn',
        duration: '10 ngày',
        instruction: 'Bổ thần kinh, hỗ trợ tuần hoàn não'
      }
    ]
  },
  {
    id: 'bbcee42b-2682-5bef',
    appointmentDate: '20/10/2025',
    timeSlot: '14:30',
    doctorName: 'ThS. BS Lê Đức Thái',
    specialty: 'Khám Da liễu',
    room: 'Phòng Da Liễu - P.201',
    serviceName: 'Khám Da liễu',
    servicePrice: 250000,
    reExamDate: '25/10/2025',
    status: 'COMPLETE',
    height: 170,
    weight: 65,
    bloodPressure: '120/80',
    temperature: 36.5,
    heartRate: 78,
    spo2: 99,
    symptoms: 'Nổi mẩn đỏ ngứa vùng cánh tay và cổ',
    initialDiagnosis: 'Viêm da tiếp xúc dị ứng',
    finalDiagnosis: 'Viêm da tiếp xúc dị ứng (L23)',
    icd10: 'L23 - Viêm da tiếp xúc dị ứng',
    advice: 'Không gãi chà xát mạnh, tạm ngưng dùng sữa tắm có chất tẩy rửa mạnh.',
    prescriptions: [
      {
        drugName: 'Cetirizine 10mg',
        dosage: '1 Viên',
        time: 'Tối',
        mealRelation: 'Sau ăn',
        duration: '7 ngày',
        instruction: 'Kháng dị ứng, chống ngứa ban đêm'
      }
    ]
  }
];

const MedicalHistory = () => {
  const { user } = useAuth();
  const [history] = useState(mockHistoryList);
  const [selectedRecord, setSelectedRecord] = useState(null);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 font-sans">
      {/* Tiêu đề Hình 3.17 */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-500">Xin chào, <span className="font-bold text-slate-800">{user?.full_name || 'Nguyễn Văn Nghĩa'}</span></h2>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-1">Lịch sử khám bệnh</h1>
        <p className="text-xs text-slate-400 mt-1">Tra cứu các buổi khám, kết quả lâm sàng và đơn thuốc đã kê.</p>
      </div>

      {/* Bảng Lịch sử khám bệnh Hình 3.17 */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase font-bold border-b border-slate-100">
                <th className="py-4 px-6">Ngày khám</th>
                <th className="py-4 px-6">Giờ khám</th>
                <th className="py-4 px-6">Bác sĩ khám</th>
                <th className="py-4 px-6">Dịch vụ</th>
                <th className="py-4 px-6">Giá dịch vụ</th>
                <th className="py-4 px-6 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-4 px-6 font-semibold text-slate-800">{item.appointmentDate}</td>
                  <td className="py-4 px-6 text-slate-600">{item.timeSlot}</td>
                  <td className="py-4 px-6 font-bold text-slate-800">{item.doctorName}</td>
                  <td className="py-4 px-6 text-teal-700 font-semibold">{item.serviceName}</td>
                  <td className="py-4 px-6 font-black text-emerald-600">{item.servicePrice.toLocaleString()} đ</td>
                  <td className="py-4 px-6 text-center">
                    <button
                      onClick={() => setSelectedRecord(item)}
                      title="Xem chi tiết buổi khám"
                      className="p-2 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-xl transition shadow-sm"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL CHI TIẾT BUỔI KHÁM & ĐƠN THUỐC (HÌNH 3.18)        */}
      {/* ======================================================== */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedRecord(null)}></div>
          <div className="relative bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 z-10 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">
                  Chi tiết buổi khám - {selectedRecord.appointmentDate}
                </h3>
                <span className="text-xs text-slate-400">Mã bệnh án: {selectedRecord.id}</span>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thông tin chung */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-sky-700 uppercase tracking-wider block text-[11px]">Thông tin chung</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-400 block">Tên người khám:</span>
                  <strong className="text-slate-800">{user?.full_name || 'Nguyễn Văn Nghĩa'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Tên dịch vụ:</span>
                  <strong className="text-slate-800">{selectedRecord.serviceName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Bác sĩ khám:</span>
                  <strong className="text-slate-800">{selectedRecord.doctorName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Ngày tái khám:</span>
                  <strong className="text-amber-700">{selectedRecord.reExamDate || 'Không có'}</strong>
                </div>
              </div>
            </div>

            {/* Kết quả khám lâm sàng & Sinh hiệu (Hình 3.18) */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-3">
              <span className="font-bold text-sky-700 uppercase tracking-wider block text-[11px]">
                Kết quả khám & Chỉ số sinh hiệu
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Chiều cao</span>
                  <strong className="text-slate-800 text-sm">{selectedRecord.height} cm</strong>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Cân nặng</span>
                  <strong className="text-slate-800 text-sm">{selectedRecord.weight} kg</strong>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Huyết áp</span>
                  <strong className="text-slate-800 text-sm">{selectedRecord.bloodPressure}</strong>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Nhiệt độ</span>
                  <strong className="text-slate-800 text-sm">{selectedRecord.temperature} °C</strong>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Nhịp tim</span>
                  <strong className="text-slate-800 text-sm">{selectedRecord.heartRate} bpm</strong>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">SpO2</span>
                  <strong className="text-slate-800 text-sm">{selectedRecord.spo2} %</strong>
                </div>
              </div>

              <div className="space-y-1.5 pt-1 text-slate-700">
                <div>Triệu chứng: <strong className="text-slate-900">{selectedRecord.symptoms}</strong></div>
                <div>Chẩn đoán ICD-10: <strong className="text-sky-700">{selectedRecord.icd10}</strong></div>
                <div>Lời dặn bác sĩ: <span className="italic text-slate-600">{selectedRecord.advice}</span></div>
              </div>
            </div>

            {/* Đơn thuốc chi tiết (Hình 3.18) */}
            <div className="space-y-3">
              <span className="font-bold text-sky-700 uppercase tracking-wider block text-[11px] flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-teal-600" />
                <span>Đơn thuốc chỉ định</span>
              </span>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="p-3">Tên thuốc</th>
                      <th className="p-3">Liều lượng</th>
                      <th className="p-3">Thời điểm uống</th>
                      <th className="p-3">Liên quan bữa ăn</th>
                      <th className="p-3">Thời gian dùng</th>
                      <th className="p-3">Hướng dẫn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRecord.prescriptions.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-800">{p.drugName}</td>
                        <td className="p-3 font-semibold text-slate-700">{p.dosage}</td>
                        <td className="p-3">{p.time}</td>
                        <td className="p-3">{p.mealRelation}</td>
                        <td className="p-3">{p.duration}</td>
                        <td className="p-3 text-slate-500">{p.instruction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Đóng hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}

      <AIChatWidget />
    </div>
  );
};

export default MedicalHistory;
