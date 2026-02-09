import { useState, useEffect } from 'react';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import { useAuthStore } from '../../stores/authStore';
import LoadingSpinner from '../shared/LoadingSpinner';

interface IEOProduct {
  id: number;
  title: string;
  symbol: string;
  status: string;
  current: number;
  total: number;
  remaining: number;
  pricePerToken: number;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface IEOProductDetailProps {
  productId: string;
}

export default function IEOProductDetail({ productId }: IEOProductDetailProps) {
  const [product, setProduct] = useState<IEOProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInvesting, setIsInvesting] = useState(false);
  const [investAmount, setInvestAmount] = useState('');
  const [showModal, setShowModal] = useState(false);
  const { t } = useAppTranslation();
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/finance/ieo/products/${productId}`);
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
          productId: product?.id,
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
      window.location.href = '/finance';
    } catch (error) {
      console.error('Invest error:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsInvesting(false);
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

  const progress = ((product.current / product.total) * 100).toFixed(2);
  const remainingPercent = ((product.remaining / product.total) * 100).toFixed(2);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
        <h1 className="text-white text-lg font-semibold">IEO Product Detail</h1>
      </div>

      <div className="p-4">
        {/* Product Card */}
        <div className="bg-gray-800 rounded-xl p-6 mb-4">
          {/* Title */}
          <h2 className="text-white text-2xl font-bold text-center mb-2">{product.title}</h2>
          <p className="text-gray-400 text-center mb-6">{product.symbol}</p>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
              <div
                className="bg-green-500 h-3 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Progress</span>
              <span className="text-white font-semibold">{progress}%</span>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <span className="text-gray-400">Raised</span>
              <span className="text-white font-semibold">
                {product.current.toLocaleString('en-US')} {product.symbol}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <span className="text-gray-400">Total Supply</span>
              <span className="text-white font-semibold">
                {product.total.toLocaleString('en-US')} {product.symbol}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <span className="text-gray-400">Remaining</span>
              <span className="text-green-400 font-semibold">
                {product.remaining.toLocaleString('en-US')} {product.symbol} ({remainingPercent}%)
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <span className="text-gray-400">Price per Token</span>
              <span className="text-white font-semibold">{product.pricePerToken} USDT</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700">
              <span className="text-gray-400">Start Date</span>
              <span className="text-white font-semibold text-sm">{formatDate(product.startDate)}</span>
            </div>
            {product.endDate && (
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">End Date</span>
                <span className="text-white font-semibold text-sm">{formatDate(product.endDate)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-400">Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                product.status === 'IN_PROGRESS' 
                  ? 'bg-green-500/20 text-green-400' 
                  : product.status === 'UPCOMING'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {product.status}
              </span>
            </div>
          </div>

          {/* Participate Button */}
          <button
            onClick={handleParticipate}
            disabled={product.status !== 'IN_PROGRESS'}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition mt-6"
          >
            {product.status === 'IN_PROGRESS' 
              ? t('finance.ieo.participate') 
              : product.status === 'UPCOMING'
              ? 'Coming Soon'
              : 'Ended'}
          </button>
        </div>

        {/* Info Section */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-3">About This IEO</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-3">
            This Initial Exchange Offering (IEO) allows you to invest in {product.symbol} tokens at a fixed price of {product.pricePerToken} USDT per token.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            The campaign has raised {product.current.toLocaleString('en-US')} {product.symbol} out of {product.total.toLocaleString('en-US')} {product.symbol} total supply, with {product.remaining.toLocaleString('en-US')} {product.symbol} remaining.
          </p>
        </div>
      </div>

      {/* Invest Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-white text-lg font-medium mb-4">Invest in {product.title}</h3>
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
                Price per token: {product.pricePerToken} USDT
              </p>
              {investAmount && (
                <p className="text-gray-400 text-xs mt-1">
                  You will receive: {((parseFloat(investAmount) || 0) / product.pricePerToken).toFixed(2)} {product.symbol}
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
