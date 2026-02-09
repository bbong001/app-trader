import { useState, useEffect } from 'react';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import { useAuthStore } from '../../stores/authStore';
import LoadingSpinner from '../shared/LoadingSpinner';

interface MiningProduct {
  id: number;
  hashRate: string;
  currency: string;
  averageDailyReturn: number;
  minimumPurchase: number;
  maximumPurchase: number | null;
  duration: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface MiningProductDetailProps {
  productId: string;
}

export default function MiningProductDetail({ productId }: MiningProductDetailProps) {
  const [product, setProduct] = useState<MiningProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [showModal, setShowModal] = useState(false);
  const { t } = useAppTranslation();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/finance/mining/products/${productId}`);
        const data = await res.json();

        if (data.success) {
          setProduct(data.product);
        } else {
          alert('Product not found');
          window.location.href = '/finance';
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        alert('Error loading product');
        window.location.href = '/finance';
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

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

    if (!product) return;

    if (amount < product.minimumPurchase) {
      alert(`Minimum purchase is ${product.minimumPurchase} ${product.currency}`);
      return;
    }

    if (product.maximumPurchase && amount > product.maximumPurchase) {
      alert(`Maximum purchase is ${product.maximumPurchase} ${product.currency}`);
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
          productId: product.id,
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
      window.location.href = '/finance';
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const minPurchaseText = product.minimumPurchase.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const maxPurchaseText = product.maximumPurchase
    ? product.maximumPurchase.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : 'Unlimited';

  return (
    <div className="bg-gray-900 min-h-screen pb-20">
      {/* Header with back button */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="text-white hover:text-green-400 transition"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 className="text-white text-lg font-semibold">Mining Product Detail</h1>
      </div>

      <div className="p-4">
        {/* Product Card */}
        <div className="bg-gray-800 rounded-xl p-6 mb-4">
          {/* Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-white"
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

          {/* Title */}
          <h2 className="text-white text-2xl font-bold text-center mb-2">{product.hashRate}</h2>
          <p className="text-gray-400 text-center mb-6">{product.currency} Mining</p>

          {/* Details */}
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <span className="text-gray-400">Currency</span>
              <span className="text-white font-semibold">{product.currency}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <span className="text-gray-400">Average Daily Return</span>
              <span className="text-green-400 font-semibold">{product.averageDailyReturn}%</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <span className="text-gray-400">Minimum Purchase</span>
              <span className="text-white font-semibold">{minPurchaseText} {product.currency}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <span className="text-gray-400">Maximum Purchase</span>
              <span className="text-white font-semibold">{maxPurchaseText} {product.currency}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <span className="text-gray-400">Duration</span>
              <span className="text-white font-semibold">{product.duration} days</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <span className="text-gray-400">Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                product.status === 'ACTIVE' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {product.status}
              </span>
            </div>
          </div>

          {/* Purchase Button */}
          <button
            onClick={handlePurchase}
            disabled={product.status !== 'ACTIVE'}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition mt-6"
          >
            {product.status === 'ACTIVE' 
              ? t('finance.mining.purchaseButton') 
              : 'Product Not Available'}
          </button>
        </div>

        {/* Info Section */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">About This Product</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            This mining product offers {product.averageDailyReturn}% average daily return over {product.duration} days. 
            The minimum investment is {minPurchaseText} {product.currency}, and you can invest up to {maxPurchaseText} {product.currency}.
          </p>
        </div>
      </div>

      {/* Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-white text-lg font-medium mb-4">Purchase {product.hashRate}</h3>
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">
                Amount ({product.currency})
              </label>
              <input
                type="number"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder={`Min: ${product.minimumPurchase} ${product.currency}`}
                className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500"
              />
              <p className="text-gray-500 text-xs mt-1">
                Daily return: {product.averageDailyReturn}%
              </p>
              {purchaseAmount && (
                <p className="text-gray-400 text-xs mt-1">
                  Estimated daily return: {((parseFloat(purchaseAmount) || 0) * product.averageDailyReturn / 100).toFixed(2)} {product.currency}
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
