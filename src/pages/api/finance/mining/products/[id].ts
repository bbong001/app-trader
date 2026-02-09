import type { APIContext } from 'astro';
import { prisma } from '../../../../../../server/prisma';

/**
 * GET /api/finance/mining/products/[id] - Lấy chi tiết Mining product
 */
export async function GET(context: APIContext): Promise<Response> {
  try {
    const id = parseInt(context.params.id!);
    
    if (isNaN(id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid product ID' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const product = await prisma.miningProduct.findUnique({
      where: { id },
      select: {
        id: true,
        hashRate: true,
        currency: true,
        averageDailyReturn: true,
        minimumPurchase: true,
        maximumPurchase: true,
        duration: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!product) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const productFormatted = {
      id: product.id,
      hashRate: product.hashRate,
      currency: product.currency,
      averageDailyReturn: Number(product.averageDailyReturn),
      minimumPurchase: Number(product.minimumPurchase),
      maximumPurchase: product.maximumPurchase ? Number(product.maximumPurchase) : null,
      duration: product.duration,
      status: product.status,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };

    return new Response(
      JSON.stringify({
        success: true,
        product: productFormatted,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Get Mining product detail error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
