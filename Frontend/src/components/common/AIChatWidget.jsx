import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Sparkles, User, Calendar, Clock, DollarSign, CheckCircle2, ChevronRight, Minimize2 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: 'Xin chào! 👋 Chào mừng bạn đến với phòng khám MediClinic. Tôi là trợ lý AI thông minh, luôn sẵn sàng hỗ trợ tư vấn dịch vụ, kiểm tra lịch khám, giá thuốc hoặc giải đáp thắc mắc 24/7!',
      time: 'Vừa xong'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const { user, isAuthenticated } = useAuth();
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
    if (!input.trim() || loading) return;

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

    try {
      // 1. Phân tích nội dung tin nhắn để phản hồi phù hợp phong cách AI Agent của đồ án
      const lower = userText.toLowerCase();

      // Kiểm tra câu hỏi về lịch hẹn cá nhân
      if (lower.includes('lịch hẹn') || lower.includes('lịch khám của tôi') || lower.includes('khi nào tôi đi khám')) {
        if (!isAuthenticated) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'ai',
              text: '🔒 Bạn cần phải đăng nhập để tra cứu thông tin cá nhân về lịch hẹn, đơn thuốc hay kết quả khám. Vui lòng đăng nhập để tiếp tục, Nick sẵn sàng hỗ trợ bạn!',
              action: { text: 'Đi đến trang Đăng nhập', link: '/login' },
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          setLoading(false);
          return;
        }

        // Đã đăng nhập -> Lấy danh sách lịch hẹn từ backend
        try {
          const res = await axiosClient.get('/appointments');
          if (res.success && res.data.length > 0) {
            const latest = res.data[0];
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                sender: 'ai',
                text: `📅 Bạn đang có cuộc hẹn sắp tới:\n\n• Ngày khám: ${latest.appointment_date}\n• Giờ khám: ${latest.time_slot}\n• Bác sĩ: ${latest.doctor_name} (${latest.specialty_name || 'Đa khoa'})\n• Phòng khám: ${latest.room_name || 'P.101'}\n• Trạng thái: ${latest.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Đang chờ duyệt'}`,
                action: { text: 'Xem toàn bộ lịch sử khám', link: '/patient/history' },
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                sender: 'ai',
                text: 'Hiện tại bạn chưa có lịch hẹn khám nào sắp tới. Bạn có muốn đặt lịch hẹn với bác sĩ chuyên khoa ngay bây giờ không?',
                action: { text: 'Đặt lịch khám ngay', link: '/patient/booking' },
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          }
          setLoading(false);
          return;
        } catch (err) {
          console.error(err);
        }
      }

      // Kiểm tra câu hỏi về lịch làm việc bác sĩ
      if (lower.includes('bác sĩ') && (lower.includes('lịch') || lower.includes('làm việc') || lower.includes('ca'))) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: `🗓️ LỊCH LÀM VIỆC CỦA BÁC SĨ (Hôm nay):\n\n• Ca 1: 08:00 - 12:00 | Sức chứa: 10 bệnh nhân\n• Ca 2: 13:30 - 17:00 | Sức chứa: 10 bệnh nhân\n\nBạn có thể chọn đặt lịch trực tiếp trên cổng hệ thống để giữ chỗ!`,
            action: { text: 'Xem danh sách Bác sĩ & Đặt lịch', link: '/patient/booking' },
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setLoading(false);
        return;
      }

      // Hỏi về triệu chứng hoặc dịch vụ y tế -> Gọi API AI phân loại triệu chứng
      const res = await axiosClient.post('/ai/classify-symptom', { symptoms: userText });
      if (res.success && res.data) {
        const d = res.data;
        let reply = `🔍 KẾT QUẢ TƯ VẤN TỪ TRỢ LÝ AI:\n\n• Chuyên khoa đề xuất: ${d.predicted_specialty}\n• Mức độ khẩn cấp: ${d.urgency_text || d.urgency_level}\n\n💡 Lời khuyên sơ bộ: ${d.initial_advice}`;
        if (d.possible_conditions && d.possible_conditions.length > 0) {
          reply += `\n\n📌 Các khả năng liên quan: ${d.possible_conditions.join(', ')}`;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: reply,
            action: {
              text: `Đặt lịch khám chuyên khoa ${d.predicted_specialty}`,
              link: '/patient/booking',
              state: { suggestedSpecialty: d.predicted_specialty, initialSymptoms: userText }
            },
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: 'Tôi đã tiếp nhận thông tin từ bạn. Để được hỗ trợ chuyên sâu, bạn có thể đặt lịch khám trực tiếp với bác sĩ chuyên khoa hoặc gọi tổng đài phòng khám 0901234567 nhé!',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: 'Xin lỗi, hiện tại kết nối trợ lý AI đang bận. Bạn vui lòng thử lại sau vài giây nhé!',
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
    <div className="fixed bottom-6 right-6 z-50">
      {/* Nút bấm mở Chatbot nổi (Hình 3.40) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-700 hover:to-teal-600 text-white px-5 py-3.5 rounded-full shadow-2xl hover:shadow-sky-500/50 transition-all transform hover:scale-105 group"
        >
          <div className="relative">
            <Bot className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white"></span>
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold leading-tight">Trợ lý AI MediClinic</div>
            <div className="text-[10px] text-sky-100">Luôn sẵn sàng hỗ trợ 24/7</div>
          </div>
        </button>
      )}

      {/* Cửa sổ Chatbot y hệt Hình 3.40 (Trang 101-104) */}
      {isOpen && (
        <div className="w-[360px] sm:w-[400px] h-[580px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-700 via-sky-600 to-teal-600 text-white p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide flex items-center gap-1.5">
                  <span>Xin chào! 👋</span>
                </h3>
                <p className="text-[11px] text-sky-100">Bắt đầu trò chuyện. Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7.</p>
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
          <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex gap-2 overflow-x-auto text-xs no-scrollbar">
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
          </div>

          {/* Body tin nhắn */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 text-sm">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-500 text-white flex items-center justify-center flex-shrink-0 text-xs shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[82%] space-y-2`}>
                  <div
                    className={`p-3.5 rounded-2xl shadow-sm text-xs leading-relaxed whitespace-pre-line ${
                      msg.sender === 'user'
                        ? 'bg-sky-600 text-white rounded-tr-none'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Nút hành động nếu AI đề xuất */}
                  {msg.action && (
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
                <span>Trợ lý AI đang suy nghĩ và tổng hợp dữ liệu...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center transition disabled:opacity-40 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AIChatWidget;
