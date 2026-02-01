import { useAppTranslation } from '../../hooks/useAppTranslation';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  variant?: 'error' | 'success';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  buttonText,
  variant = 'error',
}: ModalProps) {
  const { t } = useAppTranslation();

  if (!isOpen) return null;

  const buttonClass =
    variant === 'success'
      ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.7)]'
      : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.7)]';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
      />
      <div className="relative z-10 mx-8 max-w-sm w-full rounded-2xl bg-[#1f252b] px-6 py-5 shadow-xl border border-white/10 animate-slide-up">
        <div className="text-white font-semibold text-base mb-2 text-center">
          {title}
        </div>
        <div className="text-gray-300 text-sm mb-5 text-center">{message}</div>
        <button
          type="button"
          onClick={onClose}
          className={`mx-auto flex items-center justify-center px-6 py-2.5 rounded-full text-white text-sm font-medium ${buttonClass} active:translate-y-[1px] transition`}
        >
          {buttonText || t('common.close') || 'Close'}
        </button>
      </div>
    </div>
  );
}

