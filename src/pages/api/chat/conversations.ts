import type { APIRoute } from 'astro';
import { prisma } from '../../../server/prisma';
import { requireAuth } from '../../../server/auth';
import { NODE_ENV } from '@config.env';

export const GET: APIRoute = async (context) => {
  try {
    // Require authentication
    const authResult = requireAuth(context);
    if (authResult instanceof Response) {
      return authResult; // Returns 401 if not authenticated
    }
    const userId = authResult;

    // Only get conversations for the authenticated user
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    // Calculate unread messages for user (messages from admin)
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderType: 'admin', // Messages from admin to user
            isRead: false,
          },
        });
        return { ...conv, unreadCount };
      })
    );

    return new Response(
      JSON.stringify({ data: conversationsWithUnread }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in GET /api/chat/conversations:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: NODE_ENV === 'development' ? error.stack : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async (context) => {
  try {
    // Require authentication
    const authResult = requireAuth(context);
    if (authResult instanceof Response) {
      return authResult; // Returns 401 if not authenticated
    }
    const userId = authResult;

    // Check if user already has an open conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        userId, // Use authenticated user's ID
        status: 'OPEN',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId, // Use authenticated user's ID
          status: 'OPEN',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
    }

    return new Response(
      JSON.stringify({ data: conversation }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in POST /api/chat/conversations:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: NODE_ENV === 'development' ? error.stack : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

