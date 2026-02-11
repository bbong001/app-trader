import type { APIContext } from 'astro';
import { requireAuth } from '../../../server/auth';
import { prisma } from '../../../server/prisma';
import { Prisma } from '@prisma/client';

/**
 * POST /api/contract/settle-user - Settle expired positions for the authenticated user
 * Body: { symbol, currentPrice } - Current market price for the symbol
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

    // Find expired OPEN positions for this user
    // If symbol is provided, only settle positions for that symbol
    // Otherwise, we need to settle all symbols (but we need currentPrice for each)
    const where: any = {
      userId,
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
    const settledPositions: any[] = [];

    // Lấy hàng đợi điều khiển phiên (nếu có) - dùng chung cho tất cả users
    // Các bản ghi required = true được coi là các phiên sẽ áp dụng lần lượt.
    let sessionQueue =
      (await prisma.contractSessionControl.findMany({
        where: { required: true },
        orderBy: { createdAt: 'asc' },
      })) || [];
    let sessionIndex = 0;

    // Settle each position
    for (const position of expiredPositions) {
      try {
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
            isWin = isBuyUp
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

          // Win: cộng lại amount + netProfit vào available (vì đã trừ amount khi đặt lệnh)
          // Loss: cộng lại (amount - profitBeforeFee - fee) vào available (vì đã trừ amount khi đặt lệnh)
          const newAvailable = isWin
            ? wallet.available.add(position.amount).add(netProfit) // Win: cộng lại amount + netProfit
            : wallet.available.add(position.amount.sub(profitBeforeFee).sub(fee)); // Loss: cộng lại (amount - profitBeforeFee - fee)

          // Update wallet (chỉ update available, không dùng locked nữa)
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              available: newAvailable,
            },
          });

          // Update position
          const updatedPosition = await tx.contractPosition.update({
            where: { id: position.id },
            data: {
              status: 'CLOSED',
              exitPrice: currentPriceDecimal,
              actualProfit,
              result: isWin ? 'WIN' : 'LOSS',
              closedAt: new Date(),
            },
          });

          settledPositions.push({
            id: updatedPosition.id,
            symbol: updatedPosition.symbol,
            side: updatedPosition.side,
            result: updatedPosition.result,
            actualProfit: Number(updatedPosition.actualProfit),
          });

          settledCount++;
        });
      } catch (error: any) {
        console.error(`Error settling position ${position.id}:`, error);
        // Continue with other positions
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Settled ${settledCount} position(s)`,
        settled: settledCount,
        positions: settledPositions,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Settle user positions error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

