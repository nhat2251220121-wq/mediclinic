import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { Bot, Send, Sparkles, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import StatusBadge from '../../components/common/StatusBadge';

const AIChatSymptom = () => {
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!symptoms.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await axiosClient.post('/ai/classify-symptom', { symptoms });
      if (res.success && res.data) {
        setResult(res.data);
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi phân tích bằng AI. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookWithSpecialty = () => {
    navigate('/patient/booking', {
      state: {
        suggestedSpecialty: result?.predicted_specialty,
        initialSymptoms: symptoms
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="bg-gradient-to-r from-teal-700 via-sky-800 to-blue-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-teal-200 text-xs font-semibold mb-3 border border-white/10">
            <Sparkles className="w-4 h-4" />
            <span>MediClinic AI Assistant</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">Trợ Lý AI Phân Loại Triệu Chứng</h2>
          <p className="text-slate-200 text-sm mt-2 leading-relaxed">
            Mô tả các dấu hiệu bất thường bạn đang gặp phải (đau ở đâu, kéo dài bao lâu, triệu chứng kèm theo...). Trợ lý AI sẽ hỗ trợ định hướng chuyên khoa và đưa ra lời khuyên y tế bước đầu.
          </p>
        </div>
      </div>

      {/* Input Box */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
        <form onSubmit={handleAnalyze} className="space-y-4">
          <label className="block text-sm font-bold text-slate-800">
            Nhập mô tả triệu chứng của bạn:
          </label>
          <textarea
            rows={4}
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Ví dụ: Tôi bị đau tức ngực bên trái từ 2 hôm nay, thở hơi dốc khi leo cầu thang, kèm cảm giác hồi hộp và choáng nhẹ..."
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm transition-all"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Thông tin được bảo mật và chỉ dùng cho mục đích định hướng khám bệnh.</span>
            </div>

            <button
              type="submit"
              disabled={loading || !symptoms.trim()}
              className="px-6 py-3 bg-gradient-to-r from-teal-600 to-sky-600 text-white font-semibold rounded-xl hover:from-teal-700 hover:to-sky-700 transition flex items-center gap-2 shadow-md shadow-teal-600/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI Đang Phân Tích...</span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  <span>Phân Tích Bằng AI</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-sm">
          {error}
        </div>
      )}

      {/* AI Analysis Result Card */}
      {result && (
        <div className="bg-white rounded-3xl p-6 shadow-lg border border-teal-100 space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 text-teal-700 rounded-xl flex items-center justify-center font-bold">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Kết quả phân tích từ Trợ lý AI</h3>
                <p className="text-xs text-slate-500">Được tạo tự động theo dữ liệu triệu chứng bạn cung cấp</p>
              </div>
            </div>
            <div>
              <StatusBadge status={result.urgency_level} type="urgency" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-teal-50/60 border border-teal-100 p-4 rounded-2xl">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                Chuyên khoa đề xuất:
              </span>
              <p className="text-xl font-extrabold text-teal-900 mt-1">
                {result.predicted_specialty}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Mức độ khẩn cấp:
              </span>
              <p className="text-base font-bold text-slate-800 mt-1">
                {result.urgency_text || result.urgency_level}
              </p>
            </div>
          </div>

          {result.possible_conditions && result.possible_conditions.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Các khả năng có thể liên quan:
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.possible_conditions.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium border border-slate-200"
                  >
                    • {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-sky-50 border border-sky-100 p-4 rounded-2xl space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sky-800">
              Lời khuyên và Hướng dẫn ban đầu:
            </h4>
            <p className="text-sm text-sky-950 leading-relaxed">
              {result.initial_advice}
            </p>
          </div>

          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-800 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{result.disclaimer}</p>
          </div>

          {/* Action button: Đặt lịch ngay */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleBookWithSpecialty}
              className="px-6 py-3.5 bg-gradient-to-r from-sky-600 to-teal-600 text-white font-semibold rounded-xl hover:from-sky-700 hover:to-teal-700 transition flex items-center gap-2 shadow-lg shadow-sky-600/20"
            >
              <span>Đặt lịch khám chuyên khoa {result.predicted_specialty}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatSymptom;
