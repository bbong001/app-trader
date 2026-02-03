import { useAppTranslation } from '../../hooks/useAppTranslation';

interface OrderCountdownModalProps {
  symbol: string;
  side: 'BUY_UP' | 'BUY_DOWN';
  amount: number;
  entryPrice: number;
  duration: number;
  profitability: number;
  expectedPayout: number;
  countdownSeconds: number;
  onClose: () => void;
}

export default function OrderCountdownModal({
  symbol,
  side,
  amount,
  entryPrice,
  duration,
  profitability,
  expectedPayout,
  countdownSeconds,
  onClose,
}: OrderCountdownModalProps) {
  const { t } = useAppTranslation();

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-2xl w-80 px-5 py-6 shadow-2xl border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="text-white font-semibold text-base">
            {symbol.replace('USDT', '/USDT')}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Vòng tròn đếm ngược thời gian */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-32 h-32 rounded-full flex items-center justify-center bg-gray-800">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center"
              style={{
                backgroundImage: `conic-gradient(#22c55e ${
                  (countdownSeconds / duration) * 360
                }deg, #374151 0deg)`,
              }}
            >
              <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center">
                <span className="text-white text-2xl font-semibold">
                  {countdownSeconds}s
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-2 text-xs text-gray-400 text-center">
          Lệnh sẽ được gửi khi đếm ngược về 0
        </div>

        <div className="mt-3 mb-2 text-sm text-gray-300">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400">Transaction Type</span>
            <span className={side === 'BUY_UP' ? 'text-emerald-400' : 'text-red-400'}>
              {side === 'BUY_UP'
                ? t('contract.tradingModal.buy')
                : t('contract.tradingModal.sell')}
            </span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400">Quantity</span>
            <span className="text-white">{amount.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400">Purchase price</span>
            <span className="text-white">{entryPrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400">Duration</span>
            <span className="text-white">{duration}s</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400">Profitability</span>
            <span className="text-emerald-400">{profitability}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Expected payout</span>
            <span className="text-white">{expectedPayout.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


