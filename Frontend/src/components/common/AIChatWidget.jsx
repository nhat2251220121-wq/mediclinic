import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, ChevronRight, Minimize2 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatSymptomReply, getAssistantNavigationIntent, isSymptomBookingAllowed } from '../../utils/symptomAssistant.mjs';

const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: 'Xin chào! Tôi có thể giúp bạn định hướng chuyên khoa. Vui lòng không nhập tên, số điện thoại hoặc thông tin cá nhân. Tôi không chẩn đoán hay kê đơn.',
      time: 'Vừa xong'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [retryText, setRetryText] = useState('');
  const [emergencyBlocked, setEmergencyBlocked] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || input.length > 2000 || loading) return;

    const userText = input.trim();
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setRetryText('');

    try {
      const navigationIntent = getAssistantNavigationIntent(userText, isAuthenticated);
      if (navigationIntent) {
        setMessages((prev) => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: navigationIntent.message,
          action: navigationIntent.action,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        return;
      }

      // Stateless classification: the symptom text is not persisted as chat history.
      const res = await axiosClient.post('/ai/classify-symptom', { symptoms: userText });
      if (res.success && res.data) {
        const d = res.data;
        setEmergencyBlocked(d.urgency_level === 'EMERGENCY');
        const reply = formatSymptomReply(d);

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: reply,
            ...(isSymptomBookingAllowed(d) ? { action: {
              text: d.predicted_specialty ? `Tiếp tục đặt lịch · ${d.predicted_specialty}` : 'Tự chọn dịch vụ đặt lịch',
              link: '/patient/booking',
              state: { suggestedSpecialty: d.predicted_specialty || '', suggestedSpecialtyId: d.specialty_id || null }
            } } : {}),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: 'Hiện chưa có gợi ý phù hợp từ danh mục. Bạn có thể xem bác sĩ và lịch còn trống trên trang đặt lịch.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      setRetryText(userText);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: 'Tạm thời chưa xử lý được mô tả. Bạn có thể thử lại sau.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (q) => {
    setInput(q);
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 sm:bottom-6 sm:right-6">
      {/* Nút bấm mở Chatbot nổi - Icon tròn với tooltip */}
      {!isOpen && (
        <div className="relative group">
          <button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 bg-sky-700 hover:bg-sky-800 text-white rounded-full shadow-xl transition-colors flex items-center justify-center"
            aria-label="Trợ lý định hướng triệu chứng"
          >
            <div className="relative">
              <Bot className="w-7 h-7" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse"></span>
            </div>
          </button>
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
            🤖 Trợ lý định hướng chuyên khoa
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800"></div>
          </div>
        </div>
      )}

      {/* Cửa sổ Chatbot y hệt Hình 3.40 (Trang 101-104) */}
      {isOpen && (
        <div className="w-[min(25rem,calc(100vw-1.5rem))] h-[min(36rem,calc(100dvh-5rem))] min-h-80 max-h-[calc(100dvh-1.5rem)] min-w-0 bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="bg-sky-700 text-white p-4 flex items-center justify-between shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm tracking-wide flex items-center gap-1.5">
                  <span>Xin chào! 👋</span>
                </h3>
                <p className="break-words text-[11px] text-sky-100">Bắt đầu trò chuyện. Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7.</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-xl transition"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>

          {/* Gợi ý câu hỏi nhanh */}
          {!emergencyBlocked && <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex gap-2 overflow-x-auto text-xs no-scrollbar">
            <button
              onClick={() => handleQuickQuestion('Tôi bị đau răng ê buốt, nên khám gì?')}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-sky-600 hover:border-sky-300 whitespace-nowrap transition"
            >
              🦷 Đau răng ê buốt
            </button>
            <button
              onClick={() => handleQuickQuestion('Ngày mai tôi có lịch khám không?')}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-sky-600 hover:border-sky-300 whitespace-nowrap transition"
            >
              📅 Tra cứu lịch hẹn
            </button>
            <button
              onClick={() => handleQuickQuestion('Bác sĩ hôm nay có ca khám nào trống?')}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-sky-600 hover:border-sky-300 whitespace-nowrap transition"
            >
              👨‍⚕️ Lịch trực bác sĩ
            </button>
          </div>}

          {/* Body tin nhắn */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 text-sm">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-7 h-7 rounded-xl bg-sky-700 text-white flex items-center justify-center flex-shrink-0 text-xs shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className="max-w-[82%] min-w-0 space-y-2">
                  <div
                    className={`break-words p-3.5 rounded-2xl shadow-sm text-xs leading-relaxed whitespace-pre-line ${
                      msg.sender === 'user'
                        ? 'bg-sky-600 text-white rounded-tr-none'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Nút hành động nếu AI đề xuất */}
                  {msg.action && !emergencyBlocked && (
                    <button
                      onClick={() => {
                        navigate(msg.action.link, { state: msg.action.state });
                        setIsOpen(false);
                      }}
                      className="w-full p-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl text-xs font-bold text-teal-800 flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      <span>{msg.action.text}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <span className={`text-[10px] text-slate-400 block px-1 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-center text-xs text-slate-400 italic">
                <div className="w-7 h-7 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <span>Đang xem xét mô tả của bạn...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              maxLength={2000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Mô tả triệu chứng (tối đa 2.000 ký tự)..."
              className="min-w-0 flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all sm:px-4"
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || input.length > 2000}
              className="w-10 h-10 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center transition disabled:opacity-40 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          {retryText && !loading && <div className="px-3 pb-2 bg-white"><button onClick={() => { setInput(retryText); setRetryText(''); }} className="text-xs font-semibold text-teal-800 underline">Thử lại mô tả vừa gửi</button></div>}
        </div>
      )}
    </div>
  );
};

export default AIChatWidget;
