import { useState } from 'react';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import { useAuthStore } from '../../stores/authStore';

interface ProductCardMiningProps {
  id: number;
  hashRate: string;
  currency: string;
  averageDailyReturn: number;
  minimumPurchase: number;
  maximumPurchase: number | null;
}

export default function ProductCardMining({
  id,
  hashRate,
  currency,
  averageDailyReturn,
  minimumPurchase,
  maximumPurchase,
}: ProductCardMiningProps) {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [showModal, setShowModal] = useState(false);
  const { t } = useAppTranslation();
  const token = useAuthStore((state) => state.token);
  const minPurchaseText = minimumPurchase.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handlePurchase = () => {
    if (!token) {
      alert('Please login to purchase');
      window.location.href = '/login';
      return;
    }
    setShowModal(true);
  };

  const handleSubmitPurchase = async () => {
    const amount = parseFloat(purchaseAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (amount < minimumPurchase) {
      alert(`Minimum purchase is ${minimumPurchase} ${currency}`);
      return;
    }

    if (maximumPurchase && amount > maximumPurchase) {
      alert(`Maximum purchase is ${maximumPurchase} ${currency}`);
      return;
    }

    setIsPurchasing(true);
    try {
      const res = await fetch('/api/finance/mining/purchase', {
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
        alert(data.error || 'Failed to purchase');
        return;
      }

      alert('Purchase successful!');
      setShowModal(false);
      setPurchaseAmount('');
      window.location.reload(); // Refresh to show updated data
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-4 mx-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 
          className="text-white font-bold text-lg cursor-pointer hover:text-green-400 transition"
          onClick={() => window.location.href = `/finance/mining/${id}`}
        >
          {hashRate}
        </h3>
      </div>

      {/* Content */}
      <div className="flex items-start gap-4 mb-4">
        {/* Image/Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="text-white font-bold text-2xl mb-3">{currency}</div>
          <div className="space-y-1">
            <p className="text-white text-sm">
              {t('finance.mining.avgDailyReturn', {
                percent: averageDailyReturn,
              })}
            </p>
            <p className="text-white text-sm">
              {t('finance.mining.minPurchase', {
                amount: minPurchaseText,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 rounded-lg transition"
      >
        {t('finance.mining.purchaseButton')}
      </button>

      {/* Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-white text-lg font-medium mb-4">Purchase {hashRate}</h3>
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">
                Amount ({currency})
              </label>
              <input
                type="number"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder={`Min: ${minimumPurchase} ${currency}`}
                className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500"
              />
              <p className="text-gray-500 text-xs mt-1">
                Daily return: {averageDailyReturn}%
              </p>
              {purchaseAmount && (
                <p className="text-gray-400 text-xs mt-1">
                  Estimated daily return: {((parseFloat(purchaseAmount) || 0) * averageDailyReturn / 100).toFixed(2)} {currency}
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
                onClick={handleSubmitPurchase}
                disabled={isPurchasing}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition disabled:opacity-50"
              >
                {isPurchasing ? 'Purchasing...' : 'Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
