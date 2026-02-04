import type { APIContext } from 'astro';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../server/prisma';
import { Prisma } from '@prisma/client';
import { generateUid } from '../../../utils/generateUid';

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
    const { email, password, code } = body as { email?: string; password?: string; code?: string };

    if (!email || !password || !code) {
      return new Response(
        JSON.stringify({ error: 'Email, password, and verification code are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // Verify email code (latest non-expired)
    const verification = await (prisma as any).verificationCode.findFirst({
      where: {
        email,
        code,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!verification) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired verification code' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Email already registered' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Generate unique UID (6 letters + 4 numbers)
    let uid: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure UID is unique
    while (!isUnique && attempts < maxAttempts) {
      uid = generateUid();
      const existingUid = await prisma.user.findUnique({
        where: { uid },
        select: { id: true },
      });
      if (!existingUid) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate unique UID. Please try again.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Create user and initial wallet in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          uid: uid!,
        },
        select: { id: true, uid: true },
      });

      await tx.wallet.create({
        data: {
          userId: user.id,
          asset: 'USDT',
          available: new Prisma.Decimal(0),
          locked: new Prisma.Decimal(0),
        },
      });

      return user;
    });

    return new Response(
      JSON.stringify({
        success: true,
        userId: result.id,
        message: 'Account created successfully. Welcome bonus: 1000 USDT',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Register error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}


