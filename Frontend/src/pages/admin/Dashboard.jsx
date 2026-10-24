import React, { useEffect, useMemo, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { Activity, CalendarDays, RefreshCw, RotateCcw, Building2 } from 'lucide-react';

const clinicDate = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const shiftDate = (value, days) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getDefaultRange = () => {
  const endDate = clinicDate(new Date());
  return { startDate: shiftDate(endDate, -29), endDate };
};

const shortDate = (value, includeYear = false) => {
  const [year, month, day] = String(value).split('-');
  return includeYear ? `${day}/${month}/${year.slice(-2)}` : `${day}/${month}`;
};

const BarChart = ({ data, includeYear }) => {
  const hasData = data.some((item) => item.count > 0);
  if (!hasData) return <p className="grid h-72 place-items-center text-sm text-slate-500">Không có lịch khám trong khoảng ngày này.</p>;

  const width = 860;
  const height = 300;
  const left = 44;
  const right = 14;
  const top = 16;
  const bottom = 44;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...data.map((item) => item.count), 1);
  const yMax = Math.ceil(maxValue / 4) * 4 || 4;
  const step = chartWidth / Math.max(data.length, 1);
  const barWidth = Math.max(1, step * 0.68);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="h-72 w-full" role="img" aria-label="Biểu đồ số ca khám theo ngày">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = (yMax / 4) * tick;
          const y = top + chartHeight - (value / yMax) * chartHeight;
          return <g key={tick}>
            <line x1={left} x2={width - right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray={tick ? '3 4' : undefined} />
            <text x={left - 9} y={y + 4} textAnchor="end" className="fill-slate-500" fontSize="11">{value}</text>
          </g>;
        })}
        {data.map((item, index) => {
          const barHeight = (item.count / yMax) * chartHeight;
          const x = left + index * step + (step - barWidth) / 2;
          const y = top + chartHeight - barHeight;
          return <g key={item.date} className="group">
            <title>{`${item.date}: ${item.count} ca`}</title>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, item.count ? 2 : 0)} rx="4" fill="#168cf5" className="transition-colors group-hover:fill-sky-700" />
            {(index % labelEvery === 0 || index === data.length - 1) && <text x={x + barWidth / 2} y={height - 17} textAnchor="middle" className="fill-slate-500" fontSize="10">{shortDate(item.date, includeYear)}</text>}
          </g>;
        })}
        <line x1={left} x2={width - right} y1={top + chartHeight} y2={top + chartHeight} stroke="#cbd5e1" />
        <text x="13" y={top + chartHeight / 2} transform={`rotate(-90 13 ${top + chartHeight / 2})`} textAnchor="middle" className="fill-slate-500" fontSize="11">Số ca khám</text>
        <text x={left + chartWidth / 2} y={height - 1} textAnchor="middle" className="fill-slate-500" fontSize="11">Ngày</text>
      </svg>
    </div>
  );
};

const PIE_COLORS = ['#168cf5', '#a855f7', '#f97316', '#14b8a6', '#fbbf24', '#ef476f', '#64748b'];

const PieChart = ({ data }) => {
  const visibleData = data.filter((item) => Number(item.count) > 0);
  const total = visibleData.reduce((sum, item) => sum + Number(item.count), 0);
  if (!total) return <p className="grid h-72 place-items-center text-center text-sm text-slate-500">Chưa có ca khám để phân bổ theo chuyên khoa.</p>;

  let angle = -90;
  const cx = 130;
  const cy = 112;
  const radius = 82;
  const slices = visibleData.map((item, index) => {
    const startAngle = angle;
    const sliceAngle = (Number(item.count) / total) * 360;
    angle += sliceAngle;
    if (sliceAngle >= 359.999) return { ...item, color: PIE_COLORS[index % PIE_COLORS.length], circle: true };
    const endAngle = angle;
    const toPoint = (degrees) => {
      const radians = (degrees * Math.PI) / 180;
      return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
    };
    const [startX, startY] = toPoint(startAngle);
    const [endX, endY] = toPoint(endAngle);
    const largeArc = sliceAngle > 180 ? 1 : 0;
    return {
      ...item,
      color: PIE_COLORS[index % PIE_COLORS.length],
      path: `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`
    };
  });

  return <div className="flex h-full flex-col items-center">
    <svg viewBox="0 0 260 224" className="h-56 w-full max-w-[300px]" role="img" aria-label="Biểu đồ phân bổ ca khám theo chuyên khoa">
      {slices.map((slice) => slice.circle
        ? <circle key={slice.name} cx={cx} cy={cy} r={radius} fill={slice.color}><title>{`${slice.name}: ${slice.count} ca`}</title></circle>
        : <path key={slice.name} d={slice.path} fill={slice.color} stroke="white" strokeWidth="1.5"><title>{`${slice.name}: ${slice.count} ca`}</title></path>)}
    </svg>
    <ul className="grid w-full grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
      {slices.map((slice) => <li key={slice.name} className="flex min-w-0 items-center gap-2 text-xs text-slate-600" title={slice.name}>
        <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ backgroundColor: slice.color }} />
        <span className="min-w-0 flex-1 truncate">{slice.name}</span>
        <span className="flex-none font-medium text-slate-700">{Number(slice.count).toLocaleString('vi-VN')} ca · {Math.round((Number(slice.count) / total) * 100)}%</span>
      </li>)}
    </ul>
  </div>;
};

const StatCard = ({ label, value, detail, icon: Icon, color }) => <article className={`flex min-h-24 items-center justify-between gap-4 rounded-xl border p-4 ${color}`}>
  <div className="min-w-0">
    <h3 className="text-xs font-medium text-slate-600">{label}</h3>
    <div className="mt-1 text-2xl font-bold tracking-tight text-slate-800">{value}</div>
    <p className="mt-0.5 text-[11px] text-slate-500">{detail}</p>
  </div>
  <Icon className="h-6 w-6 flex-none opacity-80" aria-hidden="true" />
</article>;

const Dashboard = () => {
  const [draftRange, setDraftRange] = useState(getDefaultRange);
  const [appliedRange, setAppliedRange] = useState(getDefaultRange);
  const [rangeError, setRangeError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setApiError('');
    setStats(null);
    axiosClient.get('/admin/dashboard-stats', { params: appliedRange })
      .then((response) => {
        if (active && response.success) setStats(response.data);
        else if (active) setApiError('Máy chủ không trả được dữ liệu thống kê.');
      })
      .catch((error) => {
        if (active) setApiError(error.message || 'Không tải được dữ liệu dashboard. Vui lòng thử lại.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [appliedRange, refreshKey]);

  const dailyData = useMemo(() => {
    if (!stats) return [];
    const counts = new Map(stats.dailyStats.map((item) => [item.date, Number(item.count)]));
    const days = [];
    for (let date = appliedRange.startDate; date <= appliedRange.endDate; date = shiftDate(date, 1)) {
      days.push({ date, count: counts.get(date) || 0 });
    }
    return days;
  }, [stats, appliedRange]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!draftRange.startDate || !draftRange.endDate || draftRange.startDate > draftRange.endDate) {
      setRangeError('Hãy chọn khoảng ngày hợp lệ: ngày bắt đầu không sau ngày kết thúc.');
      return;
    }
    const days = (Date.parse(`${draftRange.endDate}T00:00:00Z`) - Date.parse(`${draftRange.startDate}T00:00:00Z`)) / 86400000 + 1;
    if (days > 366) {
      setRangeError('Khoảng ngày tối đa là 366 ngày.');
      return;
    }
    setRangeError('');
    setAppliedRange({ ...draftRange });
  };

  const percent = Number(stats?.followUpRate || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const spansYears = appliedRange.startDate.slice(0, 4) !== appliedRange.endDate.slice(0, 4);

  return <section className="space-y-5 text-slate-800">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">MediClinic · Báo cáo hoạt động</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Tổng quan phòng khám</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">Từ ngày
          <input type="date" value={draftRange.startDate} max={draftRange.endDate || undefined} onChange={(event) => setDraftRange((range) => ({ ...range, startDate: event.target.value }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">Đến ngày
          <input type="date" value={draftRange.endDate} min={draftRange.startDate || undefined} onChange={(event) => setDraftRange((range) => ({ ...range, endDate: event.target.value }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
        </label>
        <button type="submit" disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-60">
          <CalendarDays className="h-4 w-4" /> Xem báo cáo
        </button>
        <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading} title="Tải lại số liệu" className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </form>
    </div>

    {rangeError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{rangeError}</p>}
    {apiError && <div role="alert" className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
      <span>{apiError}</span><button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="inline-flex items-center gap-2 self-start font-semibold hover:underline"><RotateCcw className="h-4 w-4" />Thử lại</button>
    </div>}

    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <StatCard label="Tổng ca khám" value={loading ? '…' : apiError ? '—' : Number(stats?.totalAppointments || 0).toLocaleString('vi-VN')} detail="Không tính lịch đã hủy trong khoảng ngày" icon={Activity} color="border-sky-200 bg-sky-50 text-sky-700" />
      <StatCard label="Tỷ lệ tái khám" value={loading ? '…' : apiError ? '—' : `${percent}%`} detail={loading ? 'Đang tải số lượt tái khám…' : apiError ? 'Không tải được dữ liệu hiện tại' : `${Number(stats?.followUpCount || 0).toLocaleString('vi-VN')} lượt tái khám đã ghi nhận`} icon={RotateCcw} color="border-emerald-200 bg-emerald-50 text-emerald-700" />
      <StatCard label="Chuyên khoa đang hoạt động" value={loading ? '…' : apiError ? '—' : Number(stats?.activeSpecialties || 0).toLocaleString('vi-VN')} detail="Theo danh mục chuyên khoa hiện tại" icon={Building2} color="border-pink-200 bg-pink-50 text-pink-700" />
    </div>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
      <article className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-800">Số ca khám theo ngày</h2><p className="mt-1 text-xs text-slate-500">Khoảng {shortDate(appliedRange.startDate, true)} – {shortDate(appliedRange.endDate, true)}</p></header>
        <div className="p-4 sm:p-5">{loading ? <div className="grid h-72 place-items-center text-sm text-slate-500">Đang tải biểu đồ…</div> : !apiError && <BarChart data={dailyData} includeYear={spansYears} />}</div>
      </article>
      <article className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-800">Phân bổ ca khám theo chuyên khoa</h2><p className="mt-1 text-xs text-slate-500">Theo chuyên khoa của bác sĩ được phân công</p></header>
        <div className="p-4 sm:p-5">{loading ? <div className="grid h-72 place-items-center text-sm text-slate-500">Đang tải biểu đồ…</div> : !apiError && <PieChart data={stats?.specialtyStats || []} />}</div>
      </article>
    </div>
  </section>;
};

export default Dashboard;
