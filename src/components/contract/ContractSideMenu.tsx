import { useEffect, useState } from 'react';
import { binanceAPI } from '../../services/binanceApi';
import { useContractStore } from '../../stores/contractStore';

type Trend = 'up' | 'down';

interface CoinConfig {
  label: string; // BTC/USDT
  binanceSymbol: string; // BTCUSDT
}

interface CoinState extends CoinConfig {
  changePercent: number;
  trend: Trend;
}

// Khớp với USDT_ASSETS trong AssetListTab.tsx (tab Home) - chỉ dùng các coin hợp lệ trên Binance Spot API
const USDT_COINS: CoinConfig[] = [
  { label: 'BTC/USDT', binanceSymbol: 'BTCUSDT' },
  { label: 'ETH/USDT', binanceSymbol: 'ETHUSDT' },
  { label: 'BCH/USDT', binanceSymbol: 'BCHUSDT' },
  { label: 'LTC/USDT', binanceSymbol: 'LTCUSDT' },
  { label: 'UNI/USDT', binanceSymbol: 'UNIUSDT' },
  { label: 'XAU/USDT', binanceSymbol: 'PAXGUSDT' }, // Binance không có XAUUSDT trên Spot, dùng PAXGUSDT
  { label: 'DOT/USDT', binanceSymbol: 'DOTUSDT' },
  { label: 'SOL/USDT', binanceSymbol: 'SOLUSDT' },
  { label: 'TRB/USDT', binanceSymbol: 'TRBUSDT' },
  { label: 'TRX/USDT', binanceSymbol: 'TRXUSDT' },
  { label: 'XRP/USDT', binanceSymbol: 'XRPUSDT' },
  { label: 'TRUMP/USDT', binanceSymbol: 'TRUMPUSDT' },
];

interface ContractSideMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function ContractSideMenu({ open, onClose }: ContractSideMenuProps) {
  const [coins, setCoins] = useState<CoinState[]>([]);
  const storeSymbol = useContractStore((s) => s.symbol);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const initial: CoinState[] = await Promise.all(
          USDT_COINS.map(async (cfg) => {
            const ticker = await binanceAPI.getTicker(cfg.binanceSymbol);
            const changePercent = Number.isFinite(ticker.changePercent)
              ? ticker.changePercent
              : 0;
            const trend: Trend = changePercent >= 0 ? 'up' : 'down';
            return {
              ...cfg,
              changePercent,
              trend,
            };
          })
        );

        if (!cancelled) setCoins(initial);
      } catch (e) {
        console.error('Error loading contract side menu data', e);
      }
    };

    load();

    const unsubscribers = USDT_COINS.map((cfg) =>
      binanceAPI.subscribeTicker(cfg.binanceSymbol, (_price, changePercent) => {
        const value = Number.isFinite(changePercent) ? changePercent : 0;
        const trend: Trend = value >= 0 ? 'up' : 'down';
        setCoins((prev) => {
          const exists = prev.find((c) => c.binanceSymbol === cfg.binanceSymbol);
          if (!exists) return prev;
          return prev.map((c) =>
            c.binanceSymbol === cfg.binanceSymbol ? { ...c, changePercent: value, trend } : c
          );
        });
      })
    );

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsub) => unsub && unsub());
    };
  }, []);

  const handleSelect = (symbol: string) => {
    // Switch contract symbol in-place (stay on /contract)
    useContractStore.getState().setSymbol(symbol);
    onClose();
  };


  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      {/* Dimmed background */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sliding panel */}
      <div
        className={`absolute inset-y-0 left-0 w-3/4 max-w-xs bg-gray-900 shadow-xl transform transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Tabs header */}
        <div className="px-4 pt-6 pb-3 flex space-x-6">
          <button className="text-green-500 text-base font-semibold relative">
            USDT
            <span className="block h-0.5 bg-green-500 rounded-full mt-1" />
          </button>
          <button className="text-gray-400 text-base font-semibold">Derivatives</button>
        </div>

        {/* Coin list */}
        <div className="overflow-y-auto pb-6">
          {coins.map((coin) => {
            const isPositive = coin.trend === 'up';
            const isActive = storeSymbol === coin.binanceSymbol;
            return (
              <button
                key={coin.binanceSymbol}
                type="button"
                onClick={() => handleSelect(coin.binanceSymbol)}
                className={`w-full px-4 py-5 flex items-center justify-between border-b border-gray-800 transition ${
                  isActive ? 'bg-gray-700' : 'bg-gray-900 active:bg-gray-800'
                }`}
              >
                <span className="text-white text-sm">{coin.label}</span>
                <div
                  className={`flex items-center text-xs ${
                    isPositive ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {isPositive ? (
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                  <span>
                    {Number.isFinite(coin.changePercent)
                      ? `${coin.changePercent >= 0 ? '+' : ''}${coin.changePercent.toFixed(2)}%`
                      : '--'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


