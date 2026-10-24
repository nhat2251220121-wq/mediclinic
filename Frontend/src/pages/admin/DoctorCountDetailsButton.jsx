import React, { useState } from 'react';
import { Eye, RefreshCw, X } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const isEnabled = (value) => value === true || Number(value) === 1;
const isActiveDoctor = (doctor) => isEnabled(doctor.doctor_active) && isEnabled(doctor.account_active);

const DoctorCountDetailsButton = ({ item, relation }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doctors, setDoctors] = useState([]);

  const loadDoctors = async () => {
    setOpen(true);
    setLoading(true);
    setError('');
    try {
      const response = await axiosClient.get('/admin/doctors');
      const activeDoctors = (response.data || []).filter(isActiveDoctor);
      const matches = activeDoctors.filter((doctor) => {
        if (relation === 'specialty') return Number(doctor.specialty_id) === Number(item.id);
        if (relation === 'room') return Number(doctor.room_id) === Number(item.id);
        return item.specialty_id != null && Number(doctor.specialty_id) === Number(item.specialty_id);
      });
      setDoctors(matches);
    } catch (requestError) {
      setError(requestError.message || 'Không tải được danh sách bác sĩ.');
    } finally {
      setLoading(false);
    }
  };

  const relationText = relation === 'service'
    ? 'Bác sĩ thuộc chuyên khoa phụ trách dịch vụ'
    : relation === 'room'
      ? 'Bác sĩ được phân công vào phòng khám'
      : 'Bác sĩ được gán vào chuyên khoa';

  return <>
    <button type="button" onClick={loadDoctors} title="Xem danh sách bác sĩ được tính" aria-label={`Xem bác sĩ thuộc ${item.name || item.room_number}`} className="inline-flex items-center gap-1 rounded-lg p-1.5 text-sky-700 hover:bg-sky-50">
      <Eye className="h-3.5 w-3.5" />
      <span className="sr-only">Xem bác sĩ</span>
    </button>
    {open && <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="doctor-count-title">
      <button type="button" className="fixed inset-0 bg-slate-950/60" onClick={() => setOpen(false)} aria-label="Đóng danh sách bác sĩ" />
      <section className="relative z-10 max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 id="doctor-count-title" className="text-lg font-bold text-slate-900">Bác sĩ được tính · {item.name || item.room_number}</h2>
            <p className="mt-1 text-sm text-slate-500">{relationText}. Đang hoạt động khi hồ sơ bác sĩ và tài khoản đều được bật.</p>
            {relation === 'service' && <p className="mt-1 text-xs text-sky-700">Dịch vụ liên kết qua chuyên khoa, không phải gán bác sĩ trực tiếp.</p>}
            <p className="mt-2 text-sm font-semibold text-slate-700">Số bác sĩ trong danh sách: {loading ? 'Đang tải…' : doctors.length} · Trên bảng: {Number(item.doctor_count) || 0}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X className="h-5 w-5" /></button>
        </header>
        <div className="max-h-[65vh] overflow-y-auto p-5">
          {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
            : loading ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" />Đang tải danh sách bác sĩ…</div>
              : doctors.length === 0 ? <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Chưa có bác sĩ đang hoạt động được tính cho mục này.</p>
                : <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[840px] table-fixed text-left text-sm">
                    <colgroup>
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '38%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3 font-semibold">Bác sĩ</th>
                        <th className="whitespace-nowrap px-4 py-3 font-semibold">Chuyên khoa</th>
                        <th className="whitespace-nowrap px-4 py-3 font-semibold">Phòng khám</th>
                        <th className="whitespace-nowrap px-4 py-3 font-semibold">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {doctors.map((doctor) => <tr key={doctor.id} className="align-top">
                        <td className="break-words px-4 py-3 font-semibold text-slate-800 [overflow-wrap:anywhere]">{doctor.full_name || 'Chưa cập nhật'}</td>
                        <td className="break-words px-4 py-3 text-slate-600 [overflow-wrap:anywhere]">{doctor.specialty_name || 'Chưa phân chuyên khoa'}</td>
                        <td className="break-words px-4 py-3 text-slate-600 [overflow-wrap:anywhere]">{doctor.room_name ? `${doctor.room_name}${doctor.room_number ? ` (${doctor.room_number})` : ''}` : 'Chưa phân phòng'}</td>
                        <td className="px-4 py-3"><span className="inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Đang hoạt động</span></td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>}
        </div>
      </section>
    </div>}
  </>;
};

export default DoctorCountDetailsButton;
