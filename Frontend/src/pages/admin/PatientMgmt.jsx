import React, { useState } from 'react';
import { Users, Eye, ArrowLeft, Calendar, Pill, Activity, FileText } from 'lucide-react';

const mockPatientsList = [
  {
    id: 1,
    name: 'Nguyễn Văn An',
    gender: 'Nam',
    phone: '0912345678',
    address: 'Hà Nội',
    insuranceCode: 'BHYT123456',
    dob: '12/05/1995',
    emergencyContact: '0912345679',
    job: 'Nhân viên văn phòng',
    records: [
      {
        date: '01/09/2025 - Thấu máu',
        height: 160,
        weight: 55,
        bloodPressure: '110/70',
        temperature: 36.5,
        heartRate: 75,
        symptoms: 'Đau đầu, chóng mặt',
        icd10: 'D50.9 - Thiếu máu do thiếu sắt, không xác định',
        notes: 'Khuyên bổ sung sắt',
        prescriptions: [
          { drugName: 'Paracetamol 500mg', dosage: '10', unit: 'Viên', days: 5, time: 'Sáng, Tối', meal: 'Sau ăn', instruction: 'Uống với nhiều nước' },
          { drugName: 'Vitamin C 1000mg', dosage: '5', unit: 'Viên', days: 5, time: 'Sáng, Tối', meal: 'Trước ăn', instruction: 'Uống trước bữa ăn 30 phút' }
        ]
      }
    ]
  },
  {
    id: 2,
    name: 'Trần Thị B',
    gender: 'Nữ',
    phone: '0987654321',
    address: 'Hải Phòng',
    insuranceCode: 'BHYT654321',
    dob: '20/08/1992',
    emergencyContact: '0987654322',
    job: 'Giáo viên',
    records: []
  }
];

const PatientMgmt = () => {
  const [patients] = useState(mockPatientsList);
  const [selectedPatient, setSelectedPatient] = useState(null);

  return (
    <div className="space-y-6 font-sans">
      {!selectedPatient ? (
        /* ======================================================== */
        /* BẢNG DANH SÁCH BỆNH NHÂN (HÌNH 3.7 TRÊN)                 */
        /* ======================================================== */
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Danh sách bệnh nhân</h2>
              <p className="text-xs text-slate-500 mt-1">Quản lý hồ sơ bệnh nhân toàn viện MediClinic</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                    <th className="py-4 px-6">ID</th>
                    <th className="py-4 px-6">Họ tên</th>
                    <th className="py-4 px-6">Giới tính</th>
                    <th className="py-4 px-6">Số điện thoại</th>
                    <th className="py-4 px-6">Địa chỉ</th>
                    <th className="py-4 px-6">BHYT</th>
                    <th className="py-4 px-6 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patients.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-6 font-bold text-sky-600">#{p.id}</td>
                      <td className="py-4 px-6 font-bold text-slate-900">{p.name}</td>
                      <td className="py-4 px-6 text-slate-600">{p.gender}</td>
                      <td className="py-4 px-6 text-slate-700">{p.phone}</td>
                      <td className="py-4 px-6 text-slate-600">{p.address}</td>
                      <td className="py-4 px-6 font-semibold text-teal-700">{p.insuranceCode}</td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => setSelectedPatient(p)}
                          title="Xem hồ sơ bệnh án"
                          className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition"
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
        </div>
      ) : (
        /* ======================================================== */
        /* CHI TIẾT HỒ SƠ & LỊCH SỬ KHÁM BỆNH NHÂN (HÌNH 3.7 DƯỚI) */
        /* ======================================================== */
        <div className="space-y-6">
          <button
            onClick={() => setSelectedPatient(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại danh sách</span>
          </button>

          {/* Thông tin bệnh nhân */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-base font-black text-slate-800">Thông tin bệnh nhân</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Họ tên:</span>
                <strong className="text-slate-800 text-sm">{selectedPatient.name}</strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Ngày sinh:</span>
                <strong className="text-slate-800">{selectedPatient.dob}</strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Giới tính:</span>
                <strong className="text-slate-800">{selectedPatient.gender}</strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Mã BHYT:</span>
                <strong className="text-teal-700">{selectedPatient.insuranceCode}</strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Số điện thoại:</span>
                <strong className="text-slate-800">{selectedPatient.phone}</strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Người liên hệ:</span>
                <strong className="text-slate-800">{selectedPatient.emergencyContact}</strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Nghề nghiệp:</span>
                <strong className="text-slate-800">{selectedPatient.job}</strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Địa chỉ:</span>
                <strong className="text-slate-800">{selectedPatient.address}</strong>
              </div>
            </div>
          </div>

          {/* Lịch sử khám bệnh & Toa thuốc (Hình 3.7 dưới) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
            <h3 className="text-base font-black text-slate-800">Lịch sử khám bệnh</h3>

            {selectedPatient.records?.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">Bệnh nhân chưa có lịch sử khám nào.</div>
            ) : (
              selectedPatient.records.map((rec, idx) => (
                <div key={idx} className="space-y-4 border-b border-slate-100 pb-6 last:border-b-0">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-700">
                    <Calendar className="w-4 h-4" />
                    <span>{rec.date}</span>
                  </div>

                  {/* Kết quả khám */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs">
                    <span className="font-bold text-slate-700 block text-[11px] uppercase">Kết quả khám</span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div>Chiều cao: <strong>{rec.height} cm</strong></div>
                      <div>Cân nặng: <strong>{rec.weight} kg</strong></div>
                      <div>Huyết áp: <strong>{rec.bloodPressure}</strong></div>
                      <div>Nhiệt độ: <strong>{rec.temperature} °C</strong></div>
                      <div>Nhịp tim: <strong>{rec.heartRate} bpm</strong></div>
                    </div>
                    <div className="text-slate-700 pt-1">Triệu chứng: <strong>{rec.symptoms}</strong></div>
                    <div className="text-slate-700">Mã ICD-10: <strong className="text-sky-700">{rec.icd10}</strong></div>
                    <div className="text-slate-500 italic">Ghi chú: {rec.notes}</div>
                  </div>

                  {/* Đơn thuốc */}
                  <div className="space-y-2">
                    <span className="font-bold text-slate-700 block text-[11px] uppercase flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-teal-600" />
                      <span>Đơn thuốc</span>
                    </span>

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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rec.prescriptions.map((p, pIdx) => (
                            <tr key={pIdx} className="hover:bg-slate-50/50">
                              <td className="p-3 font-bold text-slate-900">{p.drugName}</td>
                              <td className="p-3">{p.dosage}</td>
                              <td className="p-3">{p.unit}</td>
                              <td className="p-3">{p.days}</td>
                              <td className="p-3">{p.time}</td>
                              <td className="p-3">{p.meal}</td>
                              <td className="p-3 text-slate-500">{p.instruction}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientMgmt;
