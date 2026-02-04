import type { APIContext } from 'astro';
import { requireAuth } from '../../../server/auth';
import { prisma } from '../../../server/prisma';

/**
 * GET /api/auth/uid - Lấy UID của user hiện tại
 */
export async function GET(context: APIContext): Promise<Response> {
  try {
    const authResult = requireAuth(context);
    if (authResult instanceof Response) {
      return authResult;
    }
    const userId = authResult;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { uid: true },
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        uid: user.uid || null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Get UID error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

