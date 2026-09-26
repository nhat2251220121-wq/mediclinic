import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle, ShieldCheck } from 'lucide-react';

const ScheduleRegistration = () => {
  const [selectedDays, setSelectedDays] = useState(['Thứ 2', 'Thứ 4', 'Thứ 6']);
  const [shift, setShift] = useState('MORNING');
  const [saved, setSaved] = useState(false);

  const daysOfWeek = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

  const toggleDay = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800">Đăng Ký Lịch Làm Việc & Trực Khám</h2>
        <p className="text-sm text-slate-500 mt-1">
          Khai báo các ngày và ca trực trong tuần để hệ thống mở khung giờ nhận bệnh nhân.
        </p>
      </div>

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-2 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>Cập nhật lịch trực thành công! Khung giờ khám đã được đồng bộ lên hệ thống.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
            Chọn các ngày trực trong tuần
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {daysOfWeek.map((day) => {
              const active = selectedDays.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`p-3 rounded-xl text-xs font-bold border transition ${
                    active
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Khung ca khám bệnh
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className={`p-4 rounded-2xl border cursor-pointer flex flex-col gap-1 transition ${
              shift === 'MORNING' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-200'
            }`}>
              <input
                type="radio"
                name="shift"
                value="MORNING"
                checked={shift === 'MORNING'}
                onChange={() => setShift('MORNING')}
                className="hidden"
              />
              <span className="font-bold text-slate-800 text-sm">Ca Sáng</span>
              <span className="text-xs text-slate-500">07:30 - 11:30</span>
            </label>

            <label className={`p-4 rounded-2xl border cursor-pointer flex flex-col gap-1 transition ${
              shift === 'AFTERNOON' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-200'
            }`}>
              <input
                type="radio"
                name="shift"
                value="AFTERNOON"
                checked={shift === 'AFTERNOON'}
                onChange={() => setShift('AFTERNOON')}
                className="hidden"
              />
              <span className="font-bold text-slate-800 text-sm">Ca Chiều</span>
              <span className="text-xs text-slate-500">13:30 - 17:00</span>
            </label>

            <label className={`p-4 rounded-2xl border cursor-pointer flex flex-col gap-1 transition ${
              shift === 'FULL_DAY' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-200'
            }`}>
              <input
                type="radio"
                name="shift"
                value="FULL_DAY"
                checked={shift === 'FULL_DAY'}
                onChange={() => setShift('FULL_DAY')}
                className="hidden"
              />
              <span className="font-bold text-slate-800 text-sm">Cả Ngày</span>
              <span className="text-xs text-slate-500">07:30 - 17:00</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition shadow-md shadow-sky-600/20"
        >
          Lưu Lịch Đăng Ký
        </button>
      </form>
    </div>
  );
};

export default ScheduleRegistration;
