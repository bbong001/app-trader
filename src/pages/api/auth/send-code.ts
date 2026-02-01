import type { APIContext } from 'astro';
import { prisma } from '../../../server/prisma';
import { sendVerificationCodeEmail } from '../../../server/email';

function generate4DigitCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function POST(context: APIContext): Promise<Response> {
  try {
    let body: unknown = {};
    try {
      body = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { email } = body as { email?: string };

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Rate limit: 60s between sends per email
    // Access verificationCode model - Prisma converts model names to camelCase
    const verificationCodeModel = (prisma as any).verificationCode;
    
    if (!verificationCodeModel) {
      console.error('VerificationCode model not found. Available models:', Object.keys(prisma).filter(key => !key.startsWith('$') && !key.startsWith('_')));
      return new Response(
        JSON.stringify({ 
          error: 'Database model not available. Please restart the development server after running: npx prisma generate' 
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const last = await verificationCodeModel.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (last) {
      const diffMs = Date.now() - new Date(last.createdAt).getTime();
      const remaining = 60 - Math.floor(diffMs / 1000);
      if (remaining > 0) {
        return new Response(
          JSON.stringify({ error: 'Please wait before requesting a new code', retryAfter: remaining }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': remaining.toString(),
            },
          }
        );
      }
    }

    const code = generate4DigitCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Create verification code (verificationCodeModel already checked above)
    await verificationCodeModel.create({
      data: {
        email,
        code,
        expiresAt,
      },
    });

    await sendVerificationCodeEmail({ to: email, code });

    return new Response(JSON.stringify({ success: true, expiresIn: 600, cooldown: 60 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Send code error:', error);

    const status =
      error?.code === 'ECONNREFUSED' || error?.code === 'P1001' ? 503 : 500;

    return new Response(
      JSON.stringify({
        error:
          error?.code === 'ECONNREFUSED' || error?.code === 'P1001'
            ? 'Database connection refused. Please set DATABASE_URL and ensure the database is reachable.'
            : 'Internal server error',
        code: error?.code,
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

