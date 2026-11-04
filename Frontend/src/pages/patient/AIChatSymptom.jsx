import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { Bot, Send, Sparkles, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import StatusBadge from '../../components/common/StatusBadge';
import { isSymptomBookingAllowed } from '../../utils/symptomAssistant.mjs';

const AIChatSymptom = () => {
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAnalyze = async (event) => {
    event?.preventDefault();
    if (!/[\p{L}\p{N}]/u.test(symptoms.trim()) || symptoms.length > 2000 || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await axiosClient.post('/ai/classify-symptom', { symptoms: symptoms.trim() });
      if (!response.success || !response.data) throw new Error(response.message || 'Không nhận được kết quả phân loại.');
      setResult(response.data);
    } catch (requestError) {
      setError(requestError.message || 'Không thể phân loại lúc này. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const canBook = isSymptomBookingAllowed(result);
  const handleBooking = () => {
    if (!canBook) return;
    navigate('/patient/booking', {
      state: {
        suggestedSpecialty: result?.predicted_specialty || '',
        suggestedSpecialtyId: result?.specialty_id || null
      }
    });
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-5 text-white shadow-sm sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-200 text-xs font-semibold mb-3 border border-white/10">
            <Sparkles className="w-4 h-4" /><span>MediClinic · Hỗ trợ chọn chuyên khoa</span>
          </div>
          <h2 className="break-words text-2xl font-extrabold tracking-tight sm:text-3xl">Trợ lý định hướng triệu chứng</h2>
          <p className="text-slate-200 text-sm mt-2 leading-relaxed">Mô tả điều bạn đang gặp để nhận gợi ý chuyên khoa và mức độ cần được chú ý. Trợ lý không chẩn đoán bệnh hoặc kê đơn.</p>
        </div>
      </div>

      <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 space-y-4 sm:p-6">
        <form onSubmit={handleAnalyze} className="space-y-4">
          <label htmlFor="symptom-description" className="block text-sm font-bold text-slate-800">Mô tả triệu chứng hoặc lý do cần khám</label>
          <textarea
            id="symptom-description"
            rows={5}
            maxLength={2000}
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            placeholder="Mô tả dấu hiệu bạn đang gặp và thời điểm bắt đầu..."
            className="w-full min-w-0 resize-y p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-start gap-2 max-w-2xl">
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <span>Khi AI được sử dụng, mô tả sẽ được gửi tới OpenAI để xử lý. MediClinic không lưu thành lịch sử trợ lý. Không nhập tên, số điện thoại hoặc thông tin nhận dạng. Đây không phải chẩn đoán.</span>
            </div>
            <button type="submit" disabled={loading || !/[\p{L}\p{N}]/u.test(symptoms.trim()) || symptoms.length > 2000} className="min-h-11 w-full justify-center rounded-xl bg-teal-800 px-6 py-3 text-white font-semibold hover:bg-teal-900 transition-colors flex items-center gap-2 disabled:opacity-50 sm:w-auto">
              {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Đang xử lý...</> : <><Bot className="w-4 h-4" /> Phân loại triệu chứng</>}
            </button>
          </div>
          <p className="text-right text-xs text-slate-400">{symptoms.length}/2.000 ký tự</p>
        </form>
      </div>

      {error && <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-sm flex items-center justify-between gap-3">
        <span>{error}</span><button onClick={() => handleAnalyze()} disabled={loading} className="shrink-0 inline-flex items-center gap-1 font-semibold underline disabled:opacity-50"><RefreshCw className="w-4 h-4" /> Thử lại</button>
      </div>}

      {result && <div className={`min-w-0 rounded-3xl border bg-white p-4 space-y-5 sm:p-6 ${result.urgency_level === 'EMERGENCY' ? 'border-red-300' : 'border-teal-100'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 text-teal-800 rounded-xl flex items-center justify-center"><Bot className="w-6 h-6" /></div>
            <div><h3 className="font-bold text-slate-900">Định hướng khám</h3><p className="text-xs text-slate-500">Thông tin tham khảo, không thay thế đánh giá y tế</p></div>
          </div>
          <StatusBadge status={result.urgency_level} type="urgency" />
        </div>

        {result.urgency_level === 'EMERGENCY' && <div role="alert" className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-2xl font-semibold">Không tiếp tục đặt lịch thông thường. Hãy gọi 115 hoặc đến cơ sở cấp cứu gần nhất ngay.</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-teal-50/60 border border-teal-100 p-4 rounded-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-800">Chuyên khoa gợi ý</span>
            <p className="mt-1 break-words text-lg font-bold text-teal-950">{result.predicted_specialty || 'Chưa xác định'}</p>
            {!result.predicted_specialty && result.urgency_level !== 'EMERGENCY' && <p className="text-sm text-teal-900 mt-1">Chưa tìm được chuyên khoa phù hợp. Bạn có thể bổ sung mô tả cụ thể hơn.</p>}
          </div>
          <div className="break-words rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-bold uppercase tracking-wider text-slate-600">Mức độ cần chú ý</span><p className="mt-1 break-words text-sm font-semibold text-slate-800">{result.urgency_text}</p></div>
        </div>

        <div className="bg-sky-50 border border-sky-100 p-4 rounded-2xl space-y-1"><h4 className="text-xs font-bold uppercase tracking-wider text-sky-800">Lời khuyên ban đầu</h4><p className="text-sm text-sky-950 leading-relaxed">{result.initial_advice}</p></div>
        {result.follow_up_questions?.length > 0 && <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl"><h4 className="text-sm font-bold text-slate-800 mb-2">Câu hỏi cần làm rõ</h4><ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">{result.follow_up_questions.map((question, index) => <li key={`${index}-${question}`}>{question}</li>)}</ul><p className="text-xs text-slate-500 mt-3">Bạn có thể bổ sung câu trả lời vào phần mô tả triệu chứng ở trên rồi gửi lại.</p></div>}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900 text-xs"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><p>{result.disclaimer}</p></div>
        {canBook && <div className="pt-1 flex justify-end"><button onClick={handleBooking} className="min-h-11 w-full justify-center rounded-xl bg-teal-800 px-5 py-3.5 text-white font-semibold hover:bg-teal-900 transition-colors flex items-center gap-2 sm:w-auto"><span className="break-words">{result.predicted_specialty ? `Tiếp tục đặt lịch · ${result.predicted_specialty}` : 'Tự chọn dịch vụ đặt lịch'}</span><ArrowRight className="h-4 w-4 shrink-0" /></button></div>}
      </div>}
    </div>
  );
};

export default AIChatSymptom;
