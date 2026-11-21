import { useRef, useState } from 'react';
import Modal from '../components/common/Modal';

/** App-styled replacements for the browser's alert/confirm/prompt dialogs. */
const useAppDialog = () => {
  const [config, setConfig] = useState(null);
  const resolver = useRef(null);

  const settle = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setConfig(null);
  };

  const open = (nextConfig) => new Promise((resolve) => {
    if (resolver.current) resolver.current(null);
    resolver.current = resolve;
    setConfig(nextConfig);
  });

  const confirm = (message, options = {}) => open({ kind: 'confirm', message, ...options });
  const prompt = (message, defaultValue = '', options = {}) => open({ kind: 'prompt', message, defaultValue, ...options });
  const alert = (message, options = {}) => open({ kind: 'alert', message, ...options });

  const dialog = config && (
    <Modal isOpen onClose={() => settle(null)} title={config.title || (config.kind === 'alert' ? 'Thông báo' : config.kind === 'prompt' ? 'Nhập thông tin' : 'Xác nhận')} maxWidth="max-w-lg">
      <form onSubmit={(event) => {
        event.preventDefault();
        settle(config.kind === 'prompt' ? event.currentTarget.elements.namedItem('app-dialog-value')?.value ?? '' : true);
      }}>
        <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-700">{config.message}</p>
        {config.kind === 'prompt' && (
          <label className="mt-4 block space-y-1 text-sm font-medium text-slate-700">
            {config.inputLabel || 'Thông tin'}
            {config.multiline ? (
              <textarea name="app-dialog-value" autoFocus defaultValue={config.defaultValue} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            ) : (
              <input name="app-dialog-value" autoFocus type={config.inputType || 'text'} inputMode={config.inputMode} defaultValue={config.defaultValue} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            )}
          </label>
        )}
        <div className="mt-6 flex justify-end gap-2">
          {config.kind !== 'alert' && <button type="button" onClick={() => settle(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Hủy</button>}
          <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">{config.confirmLabel || (config.kind === 'alert' ? 'Đóng' : 'Xác nhận')}</button>
        </div>
      </form>
    </Modal>
  );

  return { confirm, prompt, alert, dialog };
};

export default useAppDialog;
