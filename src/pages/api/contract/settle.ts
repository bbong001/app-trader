import type { APIContext } from 'astro';
import { prisma } from '../../../server/prisma';
import { Prisma } from '@prisma/client';

/**
 * POST /api/contract/settle - Settle expired positions
 * This endpoint should be called periodically (cron job) to settle expired positions
 * Body: { currentPrice } - Current market price for the symbol
 * Query: ?symbol=BTCUSDT (optional, settle all if not provided)
 */
export async function POST(context: APIContext): Promise<Response> {
  try {
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

    const { currentPrice, symbol } = body as {
      currentPrice?: number;
      symbol?: string;
    };

    if (!currentPrice) {
      return new Response(
        JSON.stringify({ error: 'currentPrice is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Find all expired OPEN positions
    const where: any = {
      status: 'OPEN',
      expiresAt: { lte: new Date() },
    };
    if (symbol) {
      where.symbol = symbol;
    }

    const expiredPositions = await prisma.contractPosition.findMany({
      where,
    });

    if (expiredPositions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No expired positions to settle',
          settled: 0,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const currentPriceDecimal = new Prisma.Decimal(currentPrice);
    let settledCount = 0;

    // Lấy hàng đợi điều khiển phiên (nếu có) - dùng chung cho tất cả users
    let sessionQueue =
      (await prisma.contractSessionControl.findMany({
        where: { required: true },
        orderBy: { createdAt: 'asc' },
      })) || [];
    let sessionIndex = 0;

    // Settle each position
    for (const position of expiredPositions) {
      await prisma.$transaction(async (tx: any) => {
        const entryPrice = position.entryPrice;
        const isBuyUp = position.side === 'BUY_UP';
        let isWin: boolean;

        // Nếu có cấu hình phiên, lấy theo hàng đợi
        if (sessionIndex < sessionQueue.length) {
          const control = sessionQueue[sessionIndex++];
          isWin = control.final === 'WIN';

          // Đánh dấu bản ghi này đã dùng xong (required = false)
          await tx.contractSessionControl.update({
            where: { id: control.id },
            data: { required: false },
          });
        } else {
          // Không còn phiên trong hàng đợi -> dùng logic mặc định theo giá
          isWin =
            isBuyUp
              ? currentPriceDecimal.gt(entryPrice) // BUY_UP wins if exit > entry
              : currentPriceDecimal.lt(entryPrice); // BUY_DOWN wins if exit < entry
        }

        // Tính profit theo profitability và trừ 1% fee
        const profitability = position.profitability || new Prisma.Decimal(0);
        const profitPercentage = profitability.div(100);
        const profitBeforeFee = position.amount.mul(profitPercentage);
        const fee = profitBeforeFee.mul(0.01); // 1% fee từ profit
        const netProfit = profitBeforeFee.sub(fee);
        
        // actualProfit: WIN = netProfit (profit sau fee), LOSS = -profitBeforeFee - fee (thua đi profit và fee)
        const actualProfit = isWin
          ? netProfit // Win: chỉ profit sau fee
          : profitBeforeFee.add(fee).negated(); // Loss: thua đi profitBeforeFee + fee

        // Get user's USDT wallet
        let wallet = await tx.wallet.findUnique({
          where: { userId_asset: { userId: position.userId, asset: 'USDT' } },
        });

        if (!wallet) {
          wallet = await tx.wallet.create({
            data: {
              userId: position.userId,
              asset: 'USDT',
              available: 0,
              locked: 0,
            },
          });
        }

        // Win: cộng lại amount/2 + netProfit vào available (vì đã trừ amount khi đặt lệnh)
        // Loss: cộng lại (amount - profitBeforeFee - fee) vào available (vì đã trừ amount khi đặt lệnh)
        const newAvailable = isWin
          ? wallet.available.add(position.amount.div(2)).add(netProfit) // Win: cộng lại amount/2 + netProfit
          : wallet.available.add(position.amount.sub(profitBeforeFee).sub(fee)); // Loss: cộng lại (amount - profitBeforeFee - fee)

        // Update wallet (chỉ update available, không dùng locked nữa)
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            available: newAvailable,
          },
        });

        // Update position
        await tx.contractPosition.update({
          where: { id: position.id },
          data: {
            status: 'CLOSED',
            exitPrice: currentPriceDecimal,
            actualProfit,
            result: isWin ? 'WIN' : 'LOSS',
            closedAt: new Date(),
          },
        });

        settledCount++;
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Settled ${settledCount} position(s)`,
        settled: settledCount,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Settle positions error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * GET /api/contract/settle - Check and settle expired positions for a specific symbol
 * Query: ?symbol=BTCUSDT&currentPrice=50000
 */
export async function GET(context: APIContext): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const symbol = url.searchParams.get('symbol');
    const currentPriceStr = url.searchParams.get('currentPrice');

    if (!symbol || !currentPriceStr) {
      return new Response(
        JSON.stringify({ error: 'symbol and currentPrice query params are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const currentPrice = parseFloat(currentPriceStr);
    if (isNaN(currentPrice)) {
      return new Response(
        JSON.stringify({ error: 'Invalid currentPrice' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Call POST logic
    const response = await POST({
      ...context,
      request: new Request(context.request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, currentPrice }),
      }),
    } as APIContext);

    return response;
  } catch (error: any) {
    console.error('Settle positions error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

