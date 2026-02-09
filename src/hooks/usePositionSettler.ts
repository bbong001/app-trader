import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useOrderResultStore } from '../stores/orderResultStore';
import { useContractStore } from '../stores/contractStore';

/** Khoảng thời gian (ms) coi là "vừa đóng" - position đóng trong khoảng này sẽ show modal */
const RECENTLY_CLOSED_MS = 90 * 1000; // 90 giây

function buildResultFromPosition(p: any) {
  const handlingFee = (p.amount * 0.1) / 100;
  return {
    positionId: p.id,
    symbol: p.symbol,
    side: p.side,
    amount: p.amount,
    entryPrice: p.entryPrice,
    exitPrice: p.exitPrice ?? p.entryPrice,
    duration: p.duration,
    profitability: p.profitability,
    actualProfit: p.actualProfit ?? 0,
    result: (p.result || 'LOSS') as 'WIN' | 'LOSS',
    handlingFee,
    createdAt: p.createdAt,
    closedAt: p.closedAt || p.createdAt,
  };
}

/**
 * Hook tự động settle positions đã expire và hiển thị modal kết quả.
 * Cả khi đóng tự động (settle-user) hay chỉnh tay từ CMS đều sẽ show OrderResultModal.
 */
export function usePositionSettler() {
  const token = useAuthStore((s) => s.token);
  const currentPrice = useContractStore((s) => s.price);
  const symbol = useContractStore((s) => s.symbol);
  const { showResultModal } = useOrderResultStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkingRef = useRef(false);
  const shownPositionsRef = useRef<Set<number>>(new Set());
  const initialLoadRef = useRef(true);
  const pendingTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!token) return;

    const checkAndSettleAndShowResults = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        // 1) Gọi settle-user (chỉ có hiệu lực khi có currentPrice và symbol)
        if (currentPrice && currentPrice > 0) {
          const settleRes = await fetch('/api/contract/settle-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ symbol, currentPrice }),
          });
          await settleRes.json();
          // Đợi DB cập nhật trước khi lấy danh sách CLOSED
          if (initialLoadRef.current) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        // 2) Luôn lấy danh sách CLOSED gần đây (bao gồm cả đóng tự động và chỉnh tay từ CMS)
        const positionRes = await fetch(`/api/contract/positions?status=CLOSED&limit=30`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const positionData = await positionRes.json();

        if (!positionData.success || !positionData.positions?.length) {
          initialLoadRef.current = false;
          return;
        }

        const now = Date.now();
        const closedPositions = (positionData.positions as any[])
          .slice()
          .sort((a: any, b: any) => {
            const tA = a.closedAt ? new Date(a.closedAt).getTime() : 0;
            const tB = b.closedAt ? new Date(b.closedAt).getTime() : 0;
            return tB - tA; // mới nhất trước
          });

        for (const p of closedPositions) {
          const closedAt = p.closedAt ? new Date(p.closedAt).getTime() : 0;
          const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : 0;
          const duration = p.duration || 0; // duration tính bằng giây
          
          // Check xem đã hết duration chưa (createdAt + duration <= now)
          const durationEndTime = createdAt + duration * 1000; // chuyển duration từ giây sang ms
          const isDurationExpired = durationEndTime <= now;
          
          // Check xem vừa mới closed trong khoảng thời gian gần đây
          const isRecentlyClosed = closedAt >= now - RECENTLY_CLOSED_MS;
          
          if (shownPositionsRef.current.has(p.id)) continue;

          // Nếu đã hết duration và vừa mới closed -> show modal ngay
          if (isDurationExpired && isRecentlyClosed) {
            shownPositionsRef.current.add(p.id);
            // Clear timeout nếu có
            const existingTimeout = pendingTimeoutsRef.current.get(p.id);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
              pendingTimeoutsRef.current.delete(p.id);
            }
            showResultModal(buildResultFromPosition(p));
            break; // Mỗi lần poll chỉ show 1 modal, lần sau sẽ show tiếp
          }
          
          // Nếu chưa hết duration nhưng đã closed -> set timeout để show modal khi hết duration
          if (!isDurationExpired && isRecentlyClosed && !pendingTimeoutsRef.current.has(p.id)) {
            const timeUntilExpired = durationEndTime - now;
            const timeout = setTimeout(() => {
              if (!shownPositionsRef.current.has(p.id)) {
                shownPositionsRef.current.add(p.id);
                showResultModal(buildResultFromPosition(p));
              }
              pendingTimeoutsRef.current.delete(p.id);
            }, timeUntilExpired);
            pendingTimeoutsRef.current.set(p.id, timeout);
          }
        }

        initialLoadRef.current = false;
      } catch (error) {
        console.error('Error checking and settling positions:', error);
      } finally {
        checkingRef.current = false;
      }
    };

    checkAndSettleAndShowResults();
    // Giảm interval xuống 500ms để check thường xuyên hơn và show modal nhanh hơn
    intervalRef.current = setInterval(checkAndSettleAndShowResults, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Clear all pending timeouts
      pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      pendingTimeoutsRef.current.clear();
    };
  }, [token, currentPrice, symbol, showResultModal]);
}

