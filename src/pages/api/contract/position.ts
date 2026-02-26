import type { APIContext } from 'astro';
import { requireAuth } from '../../../server/auth';
import { prisma } from '../../../server/prisma';
import { Prisma } from '@prisma/client';
import { SOCKET_SERVER_URL, PUBLIC_SOCKET_URL } from '@config.env';

/**
 * POST /api/contract/position - Tạo contract position mới
 * Body: { symbol, side, amount, duration, currentPrice }
 */
export async function POST(context: APIContext): Promise<Response> {
  try {
    const authResult = requireAuth(context);
    if (authResult instanceof Response) {
      return authResult;
    }
    const userId = authResult;

    let body: unknown = {};
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const {
      symbol,
      side,
      amount,
      duration,
      currentPrice,
      profitability,
    } = body as {
      symbol?: string;
      side?: string;
      amount?: number;
      duration?: number;
      currentPrice?: number;
      profitability?: number;
    };

    // Validation
    if (!symbol || !side || !amount || !duration || !currentPrice || !profitability) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: symbol, side, amount, duration, currentPrice, profitability',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (side !== 'BUY_UP' && side !== 'BUY_DOWN') {
      return new Response(
        JSON.stringify({ error: 'side must be BUY_UP or BUY_DOWN' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'amount must be greater than 0' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Kiểm tra xem user có position đang OPEN không
    const existingOpenPosition = await prisma.contractPosition.findFirst({
      where: {
        userId,
        status: 'OPEN',
      },
    });

    if (existingOpenPosition) {
      return new Response(
        JSON.stringify({ 
          error: 'Bạn đang có lệnh đang chạy, vui lòng đợi lệnh kết thúc trước khi đặt lệnh mới' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate expected profit and payout
    const amountDecimal = new Prisma.Decimal(amount);
    const profitabilityDecimal = new Prisma.Decimal(profitability);
    const expectedProfit = amountDecimal.mul(profitabilityDecimal).div(100);
    const expectedPayout = amountDecimal.add(expectedProfit);

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx: any) => {
      // Get or create USDT wallet
      let wallet = await tx.wallet.findUnique({
        where: { userId_asset: { userId, asset: 'USDT' } },
      });

      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId,
            asset: 'USDT',
            available: 0,
            locked: 0,
          },
        });
      }

      // Check balance: chỉ kiểm tra available (không dùng locked nữa)
      const available = new Prisma.Decimal(wallet.available);
      
      if (available.lt(amountDecimal)) {
        throw new Error('Insufficient balance');
      }

      // Trừ trực tiếp từ available (không lock)
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          available: wallet.available.sub(amountDecimal),
        },
      });

      // Calculate expiresAt
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + duration);

      // Create position
      const position = await tx.contractPosition.create({
        data: {
          userId,
          symbol,
          side,
          entryPrice: new Prisma.Decimal(currentPrice),
          amount: amountDecimal,
          duration,
          profitability: profitabilityDecimal,
          expectedProfit,
          expectedPayout,
          status: 'OPEN',
          expiresAt,
        },
      });

      return position;
    });

    // Notify socket-server about new contract position (fire-and-forget)
    // Note: socket.connected will be false right after io() because connection is async.
    try {
      const { io } = await import('socket.io-client');
      const socketServerUrl =
        SOCKET_SERVER_URL || PUBLIC_SOCKET_URL || 'http://localhost:3000';

      const socket = io(socketServerUrl, {
        // Allow polling fallback (websocket-only can fail in some environments)
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 5000,
        forceNew: true,
      });

      socket.on('connect', () => {
        console.log('[contract-position] connected to socket-server:', socket.id);

        socket.emit('contract:new-position-internal', {
          positionId: result.id,
          userId: result.userId,
          symbol: result.symbol,
          side: result.side,
          amount: Number(result.amount),
          createdAt: result.createdAt,
        });

        // Give it a moment to flush the emit, then disconnect
        setTimeout(() => {
          socket.disconnect();
        }, 300);
      });

      socket.on('connect_error', (e: any) => {
        console.error('[contract-position] socket connect_error:', e?.message || e);
        socket.disconnect();
      });

      socket.on('error', (e: any) => {
        console.error('[contract-position] socket error:', e?.message || e);
        socket.disconnect();
      });
    } catch (err) {
      console.error('Socket notification error:', err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        position: {
          id: result.id,
          symbol: result.symbol,
          side: result.side,
          entryPrice: Number(result.entryPrice),
          amount: Number(result.amount),
          duration: result.duration,
          profitability: Number(result.profitability),
          expectedProfit: Number(result.expectedProfit),
          expectedPayout: Number(result.expectedPayout),
          status: result.status,
          expiresAt: result.expiresAt.toISOString(),
          createdAt: result.createdAt.toISOString(),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Create contract position error:', error);

    if (error.message === 'Insufficient balance') {
      return new Response(
        JSON.stringify({ error: 'Insufficient balance' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

