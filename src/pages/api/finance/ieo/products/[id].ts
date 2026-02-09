import type { APIContext } from 'astro';
import { prisma } from '../../../../../../server/prisma';

/**
 * GET /api/finance/ieo/products/[id] - Lấy chi tiết IEO product
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

    const product = await prisma.iEOProduct.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        symbol: true,
        status: true,
        totalSupply: true,
        currentRaised: true,
        pricePerToken: true,
        startDate: true,
        endDate: true,
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

    const totalSupplyNum = Number(product.totalSupply);
    const currentRaisedNum = Number(product.currentRaised);
    const remaining = totalSupplyNum - currentRaisedNum;

    const productFormatted = {
      id: product.id,
      title: product.title,
      symbol: product.symbol,
      status: product.status,
      current: currentRaisedNum,
      total: totalSupplyNum,
      remaining,
      pricePerToken: Number(product.pricePerToken),
      startDate: product.startDate.toISOString(),
      endDate: product.endDate ? product.endDate.toISOString() : null,
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
    console.error('Get IEO product detail error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
