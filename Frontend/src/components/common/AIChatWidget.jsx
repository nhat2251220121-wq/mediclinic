import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, ChevronRight, Minimize2, Stethoscope } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAssistantNavigationIntent, getPatientChatIntent, isDirectServiceLookupIntent, normalizeSymptomTriageResult } from '../../utils/symptomAssistant.mjs';
import { getServiceBookingNavigation, normalizeServiceAdviceResult } from '../../utils/serviceAdvice.mjs';
import ImageWithFallback from './ImageWithFallback';
import StatusBadge from './StatusBadge';

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
  const [viewportMetrics, setViewportMetrics] = useState({ width: 0, height: 0, keyboardInset: 0 });
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const sendInProgressRef = useRef(false);
  const pendingDoctorScheduleRef = useRef('');

  const requestServiceAdvice = (question, specialtyId = null) => axiosClient.post('/ai/service-advice', {
    question,
    ...(specialtyId ? { specialty_id: specialtyId } : {}),
    include_doctors: isAuthenticated && user?.role === 'PATIENT'
  });

  const addServiceAdviceMessage = (data, message = 'Dưới đây là thông tin từ danh mục dịch vụ đang hoạt động.', triageResult = null) => {
    const result = normalizeServiceAdviceResult(data, message);
    const triage = normalizeSymptomTriageResult(triageResult);
    setEmergencyBlocked(result.emergency);
    setMessages((prev) => [...prev, {
      id: Date.now() + 1,
      sender: 'ai',
      text: result.message,
      ...(triage ? { triage } : {}),
      emergency: result.emergency,
      services: result.services,
      doctorsIncluded: result.doctorsIncluded,
      patientDoctorAccess: isAuthenticated && user?.role === 'PATIENT',
      serviceBookingAllowed: result.bookingAllowed,
      noServiceMatch: result.noServiceMatch,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  const openServiceDetails = (service) => {
    if (isAuthenticated && user?.role === 'PATIENT') {
      navigate('/', { state: { openServiceId: service.service_id } });
    } else {
      navigate('/', { state: { openServiceId: service.service_id } });
    }
    setIsOpen(false);
  };

  const bookService = (service) => {
    const destination = getServiceBookingNavigation(service.service_id, isAuthenticated && user?.role === 'PATIENT');
    navigate(destination.path, destination.options);
    setIsOpen(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const updateViewport = () => {
      const visualViewport = window.visualViewport;
      const width = window.innerWidth;
      const height = visualViewport?.height || window.innerHeight;
      const obscuredHeight = visualViewport
        ? Math.max(0, window.innerHeight - (visualViewport.offsetTop + visualViewport.height))
        : 0;
      const inputFocused = document.activeElement?.tagName === 'INPUT';
      setViewportMetrics({
        width,
        height,
        keyboardInset: width < 640 && inputFocused && obscuredHeight > 80 ? obscuredHeight : 0
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('focusin', updateViewport);
    window.addEventListener('focusout', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('focusin', updateViewport);
      window.removeEventListener('focusout', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

  useEffect(() => {
    const closeChat = () => setIsOpen(false);
    window.addEventListener('mediclinic:close-chat', closeChat);
    return () => window.removeEventListener('mediclinic:close-chat', closeChat);
  }, []);

  const openChat = () => {
    window.dispatchEvent(new Event('mediclinic:close-notifications'));
    setIsOpen(true);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    // State updates are asynchronous. Use a ref as a synchronous guard so a
    // rapid Enter/click pair cannot start two requests for the same message.
    if (sendInProgressRef.current || !input.trim() || input.length > 2000 || loading) return;
    sendInProgressRef.current = true;

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
    setEmergencyBlocked(false);

    try {
      const detectedPatientQueryIntent = getPatientChatIntent(userText);
      const isAnsweringScheduleClarification = Boolean(pendingDoctorScheduleRef.current)
        && (!detectedPatientQueryIntent || detectedPatientQueryIntent === 'DOCTOR_SCHEDULE');
      if (pendingDoctorScheduleRef.current && detectedPatientQueryIntent && detectedPatientQueryIntent !== 'DOCTOR_SCHEDULE') {
        pendingDoctorScheduleRef.current = '';
      }
      const patientQueryIntent = isAnsweringScheduleClarification ? 'DOCTOR_SCHEDULE' : detectedPatientQueryIntent;
      const patientQueryQuestion = isAnsweringScheduleClarification
        ? `${pendingDoctorScheduleRef.current} ${userText}`.trim()
        : userText;
      if (patientQueryIntent) {
        if (!isAuthenticated || user?.role !== 'PATIENT') {
          setMessages((prev) => [...prev, {
            id: Date.now() + 1,
            sender: 'ai',
            text: !isAuthenticated
              ? 'Để tra cứu thông tin bác sĩ, lịch làm, lịch khám hoặc bệnh án, bạn cần đăng nhập bằng tài khoản bệnh nhân trước.'
              : 'Chức năng tra cứu này chỉ dành cho tài khoản bệnh nhân.',
            ...(!isAuthenticated ? { action: { text: 'Đăng nhập', link: '/login' } } : {}),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
          return;
        }
        const response = await axiosClient.post('/ai/patient-query', { question: patientQueryQuestion });
        if (patientQueryIntent === 'DOCTOR_SCHEDULE') {
          pendingDoctorScheduleRef.current = response?.data?.needs_follow_up ? patientQueryQuestion : '';
        }
        setMessages((prev) => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: response?.data?.message || 'Chưa có kết quả tra cứu.',
          ...(response?.data?.doctor ? { doctor: response.data.doctor } : {}),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        return;
      }

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

      if (isDirectServiceLookupIntent(userText)) {
        const serviceResponse = await requestServiceAdvice(userText);
        addServiceAdviceMessage(serviceResponse.data, serviceResponse.message);
        return;
      }

      // Classification is an emergency check and optional specialty hint only.
      // The verified service-advice response is the sole source for service text,
      // card data and booking eligibility.
      let classification = null;
      let classificationMessage = '';
      try {
        const classificationResponse = await axiosClient.post('/ai/classify-symptom', { symptoms: userText });
        classificationMessage = typeof classificationResponse?.message === 'string' ? classificationResponse.message : '';
        classification = normalizeSymptomTriageResult(classificationResponse?.success ? classificationResponse?.data : null);
      } catch {
        // Service lookup still runs; that endpoint repeats emergency checks and
        // can safely continue without a specialty hint.
      }

      if (classification?.urgency_level === 'EMERGENCY') {
        setEmergencyBlocked(true);
        setMessages((prev) => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: classificationMessage || classification.urgency_text || classification.initial_advice,
          triage: classification,
          emergency: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        return;
      }

      const serviceResponse = await requestServiceAdvice(userText, classification?.specialty_id || null);
      addServiceAdviceMessage(serviceResponse.data, serviceResponse.message, classification || {});
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
      sendInProgressRef.current = false;
      setLoading(false);
    }
  };

  const handleQuickQuestion = (q) => {
    setInput(q);
  };

  return (
    <div
      className="fixed bottom-3 right-3 z-50 sm:bottom-6 sm:right-6"
      style={isOpen && viewportMetrics.width < 640 && viewportMetrics.width > 0 ? {
        right: '12px',
        bottom: `calc(12px + env(safe-area-inset-bottom) + ${viewportMetrics.keyboardInset}px)`
      } : undefined}
    >
      {/* Nút bấm mở Chatbot nổi - Icon tròn với tooltip */}
      {!isOpen && (
        <div className="relative group">
          <button
            onClick={openChat}
            className="h-[52px] w-[52px] bg-sky-700 hover:bg-sky-800 text-white rounded-full shadow-xl transition-colors flex items-center justify-center sm:h-14 sm:w-14"
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
        <div
          className="h-[65dvh] max-h-[65dvh] w-[calc(100vw-24px)] max-w-[30rem] min-w-0 bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fadeIn sm:w-[min(30rem,calc(100vw-1.5rem))] sm:h-[min(40rem,calc(100dvh-1.5rem))] sm:max-h-[calc(100dvh-1.5rem)]"
          style={viewportMetrics.width > 0 && viewportMetrics.width < 640 ? {
            height: `min(65dvh, calc(${viewportMetrics.height}px - 24px))`,
            maxHeight: `min(65dvh, calc(${viewportMetrics.height}px - 24px))`
          } : undefined}
        >
          {/* Header */}
          <div className="shrink-0 bg-sky-700 text-white p-3 sm:p-4 flex items-center justify-between shadow-sm">
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
              type="button"
              aria-label="Thu nhỏ trợ lý chat"
              title="Thu nhỏ"
              className="flex h-11 w-11 shrink-0 items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>

          {/* Gợi ý câu hỏi nhanh */}
          {!emergencyBlocked && <div className="shrink-0 bg-slate-50 px-3 py-2 border-b border-slate-100 flex gap-2 overflow-x-auto text-xs no-scrollbar">
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

                <div className={`${msg.sender === 'user' ? 'w-fit max-w-[82%]' : 'w-[calc(100%-2.5rem)]'} min-w-0 space-y-2`}>
                  <div
                    className={`break-words p-3.5 rounded-2xl shadow-sm text-xs leading-relaxed whitespace-pre-line ${
                      msg.sender === 'user'
                        ? 'bg-sky-600 text-white rounded-tr-none'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {msg.triage && <section className={`min-w-0 overflow-hidden rounded-xl border p-3 text-xs shadow-sm ${msg.triage.urgency_level === 'EMERGENCY' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`} aria-label="Kết quả định hướng triệu chứng">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-900">Định hướng triệu chứng</h4>
                      {msg.triage.urgency_level
                        ? <StatusBadge status={msg.triage.urgency_level} type="urgency" />
                        : <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Chưa xác định mức độ khẩn cấp</span>}
                    </div>
                    <p className="mt-2 break-words text-slate-700"><span className="font-semibold">Chuyên khoa gợi ý:</span> {msg.triage.predicted_specialty || 'Chưa xác định'}</p>
                    {msg.triage.urgency_text && <p className="mt-1 break-words leading-relaxed text-slate-700">{msg.triage.urgency_text}</p>}
                    {msg.triage.initial_advice && <p className="mt-1 break-words leading-relaxed text-slate-700">{msg.triage.initial_advice}</p>}
                    {msg.triage.follow_up_questions.length > 0 && <div className="mt-2 rounded-lg bg-slate-50 p-2.5">
                      <p className="font-semibold text-slate-700">Câu hỏi cần làm rõ</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-600">{msg.triage.follow_up_questions.map((question, index) => <li key={`${index}-${question}`}>{question}</li>)}</ul>
                    </div>}
                    {msg.triage.disclaimer && <p className="mt-2 border-t border-slate-200 pt-2 leading-relaxed text-slate-500">{msg.triage.disclaimer}</p>}
                    {msg.triage.recommendation_source && <p className="mt-1 text-[10px] text-slate-400">Nguồn định hướng: {msg.triage.recommendation_source === 'RULE_BASED' ? 'quy tắc dự phòng' : 'AI'}</p>}
                  </section>}

                  {msg.emergency && !msg.triage && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-900">
                    <StatusBadge status="EMERGENCY" type="urgency" />
                    <span>Không tiếp tục đặt lịch thông thường.</span>
                  </div>}

                  {msg.doctor && <article className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
                    <div className="flex min-w-0 items-start gap-3">
                      <ImageWithFallback src={msg.doctor.avatar_url} alt={msg.doctor.full_name} className="h-16 w-16 shrink-0 rounded-xl object-cover" fallback={<Stethoscope className="h-6 w-6" />} />
                      <div className="min-w-0 space-y-1 text-slate-600">
                        <h4 className="break-words font-bold text-slate-900">{msg.doctor.full_name}</h4>
                        <p>Chuyên khoa: {msg.doctor.specialty_name || 'Chưa cập nhật'}</p>
                        <p>Phòng khám: {msg.doctor.room_name || (msg.doctor.room_number ? `Phòng ${msg.doctor.room_number}` : 'Chưa cập nhật')}</p>
                        <p>Kinh nghiệm: {Number(msg.doctor.experience_years || 0)} năm</p>
                        {msg.doctor.phone && <p>Số điện thoại: <a className="text-teal-800 underline" href={`tel:${msg.doctor.phone}`}>{msg.doctor.phone}</a></p>}
                        {msg.doctor.email && <p>Email: <a className="break-all text-teal-800 underline" href={`mailto:${msg.doctor.email}`}>{msg.doctor.email}</a></p>}
                      </div>
                    </div>
                    {msg.doctor.bio && <p className="mt-2 break-words leading-relaxed text-slate-600">{msg.doctor.bio}</p>}
                  </article>}

                  {msg.services?.length > 0 && <div className="space-y-2">
                    {msg.services.map((service) => (
                      <article key={service.service_id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
                        <div className="flex min-w-0 gap-2.5">
                          <ImageWithFallback src={service.image_url} alt={service.name} className="h-16 w-20 shrink-0 rounded-lg object-cover" fallback={<Stethoscope className="h-6 w-6" />} />
                          <div className="min-w-0 flex-1">
                            <h4 className="break-words font-bold text-slate-900">{service.name}</h4>
                            <p className="mt-0.5 break-words text-teal-800">{service.specialty?.name || 'Chuyên khoa chưa cập nhật'}</p>
                            <p className="mt-1.5 line-clamp-3 break-words leading-relaxed text-slate-600">{service.description || 'Mô tả chưa được cập nhật.'}</p>
                          </div>
                        </div>
                        <p className="mt-2 font-bold text-slate-900">{service.price_available
                          ? `${Number(service.price).toLocaleString('vi-VN')} ₫`
                          : 'Giá chưa được cập nhật'}</p>

                        {msg.patientDoctorAccess && msg.doctorsIncluded && <div className="mt-2 border-t border-slate-100 pt-2">
                          <p className="font-semibold text-slate-700">Bác sĩ thuộc chuyên khoa phụ trách dịch vụ</p>
                          {service.doctors?.length
                            ? <ul className="mt-1 space-y-2 text-slate-600">{service.doctors.slice(0, 4).map((doctor) => <li key={doctor.id} className="break-words">{doctor.full_name}{doctor.room_name ? ` · ${doctor.room_name}` : ''}{doctor.phone && <div>SĐT: <a className="text-teal-800 underline" href={`tel:${doctor.phone}`}>{doctor.phone}</a></div>}{doctor.email && <div>Email: <a className="break-all text-teal-800 underline" href={`mailto:${doctor.email}`}>{doctor.email}</a></div>}</li>)}</ul>
                            : <p className="mt-1 text-slate-500">Chưa có bác sĩ đang hoạt động thuộc chuyên khoa này.</p>}
                          {service.doctor_contact_public === false && <p className="mt-1 text-slate-500">Hồ sơ bác sĩ chưa có số điện thoại hoặc email. Vui lòng liên hệ quầy/phòng khám.</p>}
                        </div>}
                        {!msg.patientDoctorAccess && <p className="mt-2 border-t border-slate-100 pt-2 text-slate-500">Đăng nhập bằng tài khoản bệnh nhân để xem bác sĩ liên quan; thông tin liên hệ chỉ hiển thị khi được phòng khám công khai.</p>}

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button type="button" onClick={() => openServiceDetails(service)} className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-semibold text-slate-700 hover:bg-slate-100">Xem chi tiết dịch vụ</button>
                          {!emergencyBlocked && msg.serviceBookingAllowed && <button type="button" onClick={() => bookService(service)} className="min-h-9 rounded-lg bg-teal-800 px-2 py-1.5 font-semibold text-white hover:bg-teal-900">Đặt lịch</button>}
                        </div>
                      </article>
                    ))}
                  </div>}

                  {msg.noServiceMatch && !emergencyBlocked && <button type="button" onClick={() => { navigate('/#services'); setIsOpen(false); }} className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-teal-800">Xem danh mục dịch vụ</button>}

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
          <form onSubmit={handleSend} className="shrink-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-100 flex items-center gap-2">
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
