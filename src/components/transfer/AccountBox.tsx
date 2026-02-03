type TransferDirection = 'coins-to-contract' | 'contract-to-coins';

interface Props {
  fromLabel: string;
  toLabel: string;
  direction: TransferDirection;
  onToggleDirection: () => void;
}

export default function AccountBox({ fromLabel, toLabel, direction, onToggleDirection }: Props) {
  return (
    <div className="mt-5 mx-4 rounded-2xl border border-white/15 bg-[#1f252b] shadow-[0_10px_20px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="px-4 py-4 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-teal-400" />
        <div className="flex flex-col flex-1">
          <span className="text-gray-400 text-xs">From</span>
          <span className="text-white text-sm">{fromLabel}</span>
        </div>
      </div>
      <div className="mx-4 h-px bg-white/10 relative">
        {/* Toggle button in the middle */}
        <button
          type="button"
          onClick={onToggleDirection}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-400/30 flex items-center justify-center hover:bg-emerald-500/30 active:scale-95 transition-all"
          aria-label="Toggle transfer direction"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-emerald-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
          </svg>
        </button>
      </div>
      <div className="px-4 py-4 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-rose-500" style={{ backgroundColor: '#FF6B6B' }}/>
        <div className="flex flex-col flex-1">
          <span className="text-gray-400 text-xs">To</span>
          <span className="text-white text-sm">{toLabel}</span>
        </div>
      </div>
    </div>
  );
}


