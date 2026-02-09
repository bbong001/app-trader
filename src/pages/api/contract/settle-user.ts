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

    // Settle each position
    for (const position of expiredPositions) {
      try {
        await prisma.$transaction(async (tx: any) => {
          const entryPrice = position.entryPrice;
          const isBuyUp = position.side === 'BUY_UP';
          const isWin =
            isBuyUp
              ? currentPriceDecimal.gt(entryPrice) // BUY_UP wins if exit > entry
              : currentPriceDecimal.lt(entryPrice); // BUY_DOWN wins if exit < entry

          // Win = ăn đúng số tiền đặt (profit = amount). Loss = thua hết số tiền đặt.
          const actualProfit = isWin
            ? position.amount // Win: profit = amount (tổng nhận = amount + amount = 2*amount)
            : position.amount.negated(); // Loss: lose entire amount

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

          // Unlock the locked amount
          const lockedAmount = position.amount;
          const newLocked = wallet.locked.sub(lockedAmount);

          // Win: trả lại stake + profit = 2*amount. Loss: chỉ unlock, không hoàn tiền.
          const newAvailable = isWin
            ? wallet.available.add(position.amount).add(position.amount) // Win: amount + amount
            : wallet.available; // Loss: just unlock, no refund

          // Update wallet
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              available: newAvailable,
              locked: newLocked,
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

