import { useState, useEffect } from 'react';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import { useAuthStore } from '../../stores/authStore';
import LoadingSpinner from '../shared/LoadingSpinner';

interface AccountFundsProps {
  currentPrice: number;
  symbol: string;
  onOpenBuyUp: () => void;
  onOpenBuyDown: () => void;
}

interface ContractPosition {
  id: number;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number | null;
  amount: number;
  duration: number;
  profitability: number;
  expectedProfit: number;
  expectedPayout: number;
  actualProfit: number | null;
  status: string;
  result: string | null;
  createdAt: string;
  expiresAt: string;
  closedAt: string | null;
}

export default function AccountFunds({
  currentPrice,
  symbol,
  onOpenBuyUp,
  onOpenBuyDown,
}: AccountFundsProps) {
  const [activeTab, setActiveTab] = useState<'transaction' | 'closed'>('transaction');
  const [balance, setBalance] = useState<{ available: number; locked: number; total: number }>({
    available: 0,
    locked: 0,
    total: 0,
  });
  const [openPositions, setOpenPositions] = useState<ContractPosition[]>([]);
  const [closedPositions, setClosedPositions] = useState<ContractPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useAppTranslation();
  const token = useAuthStore((state) => state.token);

  // Auto-settle expired positions for current symbol
  useEffect(() => {
    if (!token || !currentPrice) return;

    const settleExpiredPositions = async () => {
      try {
        const settleRes = await fetch('/api/contract/settle-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            symbol,
            currentPrice,
          }),
        });

        const settleData = await settleRes.json();
        if (settleData.success && settleData.settled > 0) {
          // Refresh positions after settling
          const [openRes, closedRes, balanceRes] = await Promise.all([
            fetch('/api/contract/positions?status=OPEN', {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch('/api/contract/positions?status=CLOSED', {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch('/api/contract/balance', {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

          const openData = await openRes.json();
          const closedData = await closedRes.json();
          const balanceData = await balanceRes.json();

          if (openData.success) {
            setOpenPositions(openData.positions);
          }
          if (closedData.success) {
            setClosedPositions(closedData.positions);
          }
          if (balanceData.success) {
            setBalance(balanceData.balance);
          }
        }
      } catch (error) {
        console.error('Error settling positions:', error);
      }
    };

    // Settle immediately on mount and when price/symbol changes
    settleExpiredPositions();
  }, [token, currentPrice, symbol]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch balance and positions in parallel
        const [balanceRes, openRes, closedRes] = await Promise.all([
          fetch('/api/contract/balance', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/contract/positions?status=OPEN', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/contract/positions?status=CLOSED', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const balanceData = await balanceRes.json();
        const openData = await openRes.json();
        const closedData = await closedRes.json();

        if (balanceData.success) {
          setBalance(balanceData.balance);
        }
        if (openData.success) {
          setOpenPositions(openData.positions);
        }
        if (closedData.success) {
          setClosedPositions(closedData.positions);
        }
      } catch (error) {
        console.error('Error fetching contract data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Refresh when tab changes
  useEffect(() => {
    if (!token) return;

    const fetchPositions = async () => {
      try {
        const status = activeTab === 'transaction' ? 'OPEN' : 'CLOSED';
        const res = await fetch(`/api/contract/positions?status=${status}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          if (activeTab === 'transaction') {
            setOpenPositions(data.positions);
          } else {
            setClosedPositions(data.positions);
          }
        }
      } catch (error) {
        console.error('Error fetching positions:', error);
      }
    };

    fetchPositions();
  }, [activeTab, token]);

  return (
    <div className="bg-gray-900 px-4 py-4">
      {/* Account Funds Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-sm">
          {t('contract.accountFunds.title')}
        </span>
        <span className="text-gray-400 text-sm">
          {isLoading ? '...' : `${balance.available.toFixed(2)} USDT`}
        </span>
      </div>

      {/* Buy Up / Buy Down Buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={onOpenBuyUp}
          className="flex-1 bg-teal-400 text-gray-900 font-medium py-3 rounded-lg active:opacity-80"
        >
          {t('contract.accountFunds.buyUp')}
        </button>
        <button
          onClick={onOpenBuyDown}
          className="flex-1 bg-red-500 text-white font-medium py-3 rounded-lg active:opacity-80"
        >
          {t('contract.accountFunds.buyDown')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 pb-2">
        <button
          onClick={() => setActiveTab('transaction')}
          className={`text-sm font-medium relative pb-1 ${
            activeTab === 'transaction'
              ? 'text-emerald-400'
              : 'text-gray-400'
          }`}
          >
          {t('contract.accountFunds.tabTransaction')}
          {activeTab === 'transaction' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('closed')}
          className={`text-sm font-medium ${
            activeTab === 'closed' ? 'text-emerald-400' : 'text-gray-400'
          }`}
          >
          {t('contract.accountFunds.tabClosed')}
        </button>
      </div>

      {/* Positions List */}
      {activeTab === 'transaction' && (
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <LoadingSpinner />
          ) : openPositions.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-8">
              {t('contract.accountFunds.empty')}
            </div>
          ) : (
            openPositions.map((position) => {
              const displaySymbol = position.symbol.replace('USDT', '/USDT');
              const isBuyUp = position.side === 'BUY_UP';
              const timeLeft = Math.max(0, Math.floor((new Date(position.expiresAt).getTime() - Date.now()) / 1000));

              const handleClick = () => {
                window.location.href = `/contract-detail?id=${position.id}`;
              };

              return (
                <button
                  key={position.id}
                  type="button"
                  onClick={handleClick}
                  className="w-full text-left bg-gray-800 rounded-lg p-3 border border-gray-700 active:bg-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">{displaySymbol}</span>
                    <span
                      className={`text-xs font-medium ${
                        isBuyUp ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isBuyUp ? t('contract.tradingModal.buy') : t('contract.tradingModal.sell')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Amount: {position.amount.toFixed(2)}</span>
                    <span>Profit: {position.expectedProfit.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Entry: {position.entryPrice.toFixed(2)}</span>
                    <span>Time left: {timeLeft}s</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
      {activeTab === 'closed' && (
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <LoadingSpinner />
          ) : closedPositions.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-8">
              {t('contract.accountFunds.empty')}
            </div>
          ) : (
            closedPositions.map((position) => {
              const displaySymbol = position.symbol.replace('USDT', '/USDT');
              const isBuyUp = position.side === 'BUY_UP';
              const isWin = position.result === 'WIN';
              const handleClick = () => {
                window.location.href = `/contract-detail?id=${position.id}`;
              };

              return (
                <button
                  key={position.id}
                  type="button"
                  onClick={handleClick}
                  className="w-full text-left bg-gray-800 rounded-lg p-3 border border-gray-700 active:bg-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">{displaySymbol}</span>
                    <span
                      className={`text-xs font-medium ${
                        isWin ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isWin ? 'WIN' : 'LOSS'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Amount: {position.amount.toFixed(2)}</span>
                    <span
                      className={isWin ? 'text-emerald-400' : 'text-red-400'}
                    >
                      {position.actualProfit !== null
                        ? `${isWin ? '+' : ''}${position.actualProfit.toFixed(2)}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Entry: {position.entryPrice.toFixed(2)}</span>
                    {position.exitPrice && (
                      <span>Exit: {position.exitPrice.toFixed(2)}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
