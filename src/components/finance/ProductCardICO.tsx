import { useState } from 'react';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import { useAuthStore } from '../../stores/authStore';

interface ProductCardICOProps {
  id: number;
  title: string;
  status: string;
  current: number;
  total: number;
  remaining: number;
  symbol: string;
  pricePerToken: number;
}

export default function ProductCardICO({
  id,
  title,
  status,
  current,
  total,
  remaining,
  symbol,
  pricePerToken,
}: ProductCardICOProps) {
  const [isInvesting, setIsInvesting] = useState(false);
  const [investAmount, setInvestAmount] = useState('');
  const [showModal, setShowModal] = useState(false);
  const progress = ((current / total) * 100).toFixed(2);
  const remainingPercent = ((remaining / total) * 100).toFixed(2);
  const { t } = useAppTranslation();
  const token = useAuthStore((state) => state.token);

  const handleParticipate = () => {
    if (!token) {
      alert('Please login to participate');
      window.location.href = '/login';
      return;
    }
    setShowModal(true);
  };

  const handleInvest = async () => {
    const amount = parseFloat(investAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsInvesting(true);
    try {
      const res = await fetch('/api/finance/ieo/invest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: id,
          amount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to invest');
        return;
      }

      alert('Investment successful!');
      setShowModal(false);
      setInvestAmount('');
      window.location.reload(); // Refresh to show updated data
    } catch (error) {
      console.error('Invest error:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsInvesting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-4 mx-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 
          className="text-white font-medium text-lg cursor-pointer hover:text-green-400 transition"
          onClick={() => window.location.href = `/finance/ieo/${id}`}
        >
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">
            {t('finance.ieo.statusInProgress')}
          </span>
          <button
            onClick={handleParticipate}
            className="bg-green-500 hover:bg-green-600 text-white text-xs px-2.5 py-1.5 rounded-lg font-medium transition whitespace-nowrap"
          >
            {t('finance.ieo.participate')}
          </button>
        </div>
      </div>

      {/* Progress Info */}
      <div className="mb-3">
        <p className="text-white text-sm">
          {current.toLocaleString('en-US')} {symbol} / {total.toLocaleString('en-US')} {symbol}{' '}
          {t('finance.ieo.remainingPercent', { percent: remainingPercent })}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-gray-400 text-xs mt-1">{remainingPercent}%</div>
      </div>

      {/* Invest Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-white text-lg font-medium mb-4">Invest in {title}</h3>
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">
                Amount (USDT)
              </label>
              <input
                type="number"
                value={investAmount}
                onChange={(e) => setInvestAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500"
              />
              <p className="text-gray-500 text-xs mt-1">
                Price per token: {pricePerToken} USDT
              </p>
              {investAmount && (
                <p className="text-gray-400 text-xs mt-1">
                  You will receive: {((parseFloat(investAmount) || 0) / pricePerToken).toFixed(2)} {symbol}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleInvest}
                disabled={isInvesting}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition disabled:opacity-50"
              >
                {isInvesting ? 'Investing...' : 'Invest'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
