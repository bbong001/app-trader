import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import ChatMessage from './ChatMessage';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import LoadingSpinner from '../shared/LoadingSpinner';
import { compressImage } from '../../utils/imageCompression';
import { useAuthStore } from '../../stores/authStore';

interface Message {
  id: number;
  senderId: number;
  senderType: 'user' | 'admin';
  content: string | null;
  imageUrl: string | null;
  createdAt: string;
  isRead: boolean;
}

export default function ChatWindow() {
  const { t } = useAppTranslation();
  const { isLoggedIn, userId, token } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [uploading, setUploading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const oldestMessageDateRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const conversationIdRef = useRef<number | null>(null);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Check authentication before initializing
  useEffect(() => {
    if (!isLoggedIn || !userId) {
      setLoading(false);
      return;
    }
  }, [isLoggedIn, userId]);

  // Initialize socket connection
  useEffect(() => {
    if (!isLoggedIn || !userId) return;

    // Use environment variable for socket URL, fallback to localhost for development
    const socketUrl = import.meta.env.PUBLIC_SOCKET_URL || 
      (process.env.NODE_ENV === 'production' 
        ? 'https://app-trader.railway.internal' 
        : 'http://localhost:3000');
    
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      auth: {
        userId,
        token,
      },
      query: {
        userId: userId?.toString() || '',
      },
    });
    
    // Handle socket errors
    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      setConnectionStatus('disconnected');
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionStatus('disconnected');
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      setConnectionStatus('connected');
      
      // Start heartbeat to keep connection alive
      heartbeatIntervalRef.current = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit('ping');
        }
      }, 30000); // Ping every 30 seconds
      
      // If conversationId is already set, join the room immediately
      if (conversationId && userId) {
        newSocket.emit('join-conversation', {
          conversationId: conversationId,
          userId: userId,
        });
        console.log('Rejoined conversation room on reconnect:', conversationId);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from socket server');
      setConnectionStatus('disconnected');
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    });

    newSocket.on('reconnect_attempt', () => {
      setConnectionStatus('connecting');
    });

    newSocket.on('typing', (data: { conversationId: number; isTyping: boolean }) => {
      if (data.conversationId === conversationId) {
        setIsTyping(data.isTyping);
        if (data.isTyping) {
          // Auto-hide typing indicator after 3 seconds
          setTimeout(() => setIsTyping(false), 3000);
        }
      }
    });

    const handleNewMessage = (message: Message & { conversationId?: number }) => {
      const currentConvId = conversationIdRef.current;
      console.log('App received new-message:', message, 'current conversationId:', currentConvId);
      
      // Only process messages for current conversation
      if (message.conversationId !== undefined && currentConvId !== null) {
        if (message.conversationId !== currentConvId) {
          console.log('Ignoring message from different conversation:', message.conversationId, 'current:', currentConvId);
          return;
        }
      }
      
      setMessages((prev) => {
        // Check if message already exists (avoid duplicates)
        const exists = prev.some((m) => m.id === message.id);
        if (exists) {
          console.log('Message already exists, skipping:', message.id);
          return prev;
        }
        
        console.log('Adding new message to state:', message);
        // Add new message
        return [...prev, message];
      });
      
      // Only process notifications for admin messages
      if (message.senderType === 'admin') {
        setUnreadCount((prev) => prev + 1);
        playNotificationSound();
      }
      scrollToBottom();
    };

    newSocket.on('new-message', handleNewMessage);

    newSocket.on('user-notification', (data: any) => {
      // user-notification is redundant, new-message already handles it
      // But keep it for backward compatibility, just don't duplicate
      if (data.message) {
        handleNewMessage(data.message);
      }
    });

    newSocket.on('messages-read', () => {
      setUnreadCount(0);
    });

    setSocket(newSocket);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      newSocket.off('new-message', handleNewMessage);
      newSocket.off('user-notification');
      newSocket.off('messages-read');
      newSocket.off('typing');
      newSocket.disconnect();
    };
  }, [isLoggedIn, userId, token]);

  // Update conversationId ref when it changes
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Join conversation room when conversationId or socket changes
  useEffect(() => {
    if (socket && socket.connected && conversationId && userId) {
      socket.emit('join-conversation', {
        conversationId: conversationId,
        userId: userId,
      });
      console.log('Joined conversation room (useEffect):', conversationId);
    }
  }, [socket, conversationId, userId]);

  // Load or create conversation
  useEffect(() => {
    if (!isLoggedIn || !userId || !token) return;

    const loadConversation = async () => {
      try {
        // Try to get existing conversation with auth token
        const response = await fetch(`/api/chat/conversations`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            // Unauthorized - user not logged in
            console.error('Unauthorized access to chat - please log in');
            setLoading(false);
            return;
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to load conversation');
        }
        
        const data = await response.json();
        
        let convId: number;
        if (data.data && data.data.length > 0) {
          convId = data.data[0].id;
        } else {
          // Create new conversation with auth token
          const createResponse = await fetch('/api/chat/conversations', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ userId }),
          });
          
          if (!createResponse.ok) {
            if (createResponse.status === 401) {
              console.error('Unauthorized - please log in');
              setLoading(false);
              return;
            }
            const errorData = await createResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to create conversation');
          }
          
          const createData = await createResponse.json();
          convId = createData.data.id;
        }

        setConversationId(convId);

        // Load messages first
        await loadMessages(convId);

        // Join conversation room with userId for validation
        // Do this after messages are loaded to ensure socket is ready
        if (socket && socket.connected) {
          socket.emit('join-conversation', { 
            conversationId: convId,
            userId: userId,
          });
          console.log('Joined conversation room:', convId);
        } else {
          console.warn('Socket not connected, will join when socket connects');
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
        setLoading(false);
      }
    };

    if (userId && socket && token) {
      loadConversation();
    }
  }, [userId, socket, token, isLoggedIn]);

  const loadMessages = async (convId: number, before?: string) => {
    if (!token) return;
    
    try {
      if (before) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      const url = before
        ? `/api/chat/messages?conversationId=${convId}&limit=50&before=${before}`
        : `/api/chat/messages?conversationId=${convId}&limit=50`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          console.error('Unauthorized access to messages');
          return;
        }
        if (response.status === 403) {
          console.error('Access denied to this conversation');
          return;
        }
        throw new Error(data.error || 'Failed to load messages');
      }
      const newMessages = data.data || [];
      
      if (before) {
        // Loading older messages - prepend to existing
        if (newMessages.length === 0) {
          setHasMore(false);
        } else {
          setMessages((prev) => [...newMessages, ...prev]);
          oldestMessageDateRef.current = newMessages[0]?.createdAt || null;
        }
      } else {
        // Initial load
        setMessages(newMessages);
        if (newMessages.length > 0) {
          oldestMessageDateRef.current = newMessages[0]?.createdAt || null;
        }
        setHasMore(newMessages.length === 50);
      }

      // Count unread messages (only on initial load)
      if (!before) {
        const unread = newMessages.filter((m: Message) => 
          m.senderType === 'admin' && !m.isRead
        ).length;
        setUnreadCount(unread);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Load older messages when scrolling to top
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    // Check if scrolled to top (within 50px)
    if (container.scrollTop < 50 && !loadingMore && hasMore && oldestMessageDateRef.current && conversationId) {
      const previousScrollHeight = container.scrollHeight;
      const beforeDate = oldestMessageDateRef.current;
      
      // Load older messages
      (async () => {
        try {
          setLoadingMore(true);
          const url = `/api/chat/messages?conversationId=${conversationId}&limit=50&before=${beforeDate}`;
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await response.json();
          
          if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
              console.error('Unauthorized access');
              return;
            }
            throw new Error(data.error || 'Failed to load messages');
          }
          const newMessages = data.data || [];
          
          if (newMessages.length === 0) {
            setHasMore(false);
          } else {
            setMessages((prev) => [...newMessages, ...prev]);
            oldestMessageDateRef.current = newMessages[0]?.createdAt || null;
            
            // Maintain scroll position after loading older messages
            setTimeout(() => {
              if (messagesContainerRef.current) {
                const newScrollHeight = messagesContainerRef.current.scrollHeight;
                messagesContainerRef.current.scrollTop = newScrollHeight - previousScrollHeight;
              }
            }, 100);
          }
        } catch (error) {
          console.error('Error loading older messages:', error);
        } finally {
          setLoadingMore(false);
        }
      })();
    }
  }, [loadingMore, hasMore, conversationId, token]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const playNotificationSound = () => {
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Fallback: use browser notification API
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New message', {
            body: 'You have a new message from support',
            icon: '/favicon.ico',
          });
        }
      });
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !conversationId || !socket) return;

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('typing', { conversationId, isTyping: false });

    try {
      socket.emit('send-message', {
        conversationId,
        senderId: userId,
        senderType: 'user',
        content: trimmed,
        imageUrl: null,
      });

      setInput('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId || !socket) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB before compression)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Compress image before upload
      const compressedFile = await compressImage(file, 500); // Max 500KB
      console.log(`Image compressed: ${file.size / 1024}KB -> ${compressedFile.size / 1024}KB`);

      const formData = new FormData();
      formData.append('image', compressedFile);

      const response = await fetch('/api/chat/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.data?.imageUrl) {
        socket.emit('send-message', {
          conversationId,
          senderId: userId,
          senderType: 'user',
          content: null,
          imageUrl: data.data.imageUrl,
        });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0 && socket && conversationId) {
      const unreadAdminMessages = messages.filter(
        (m) => m.senderType === 'admin' && !m.isRead
      );
      if (unreadAdminMessages.length > 0) {
        socket.emit('mark-read', {
          conversationId,
          senderType: 'user',
        });
      }
    }
  }, [messages, socket, conversationId]);

  // Show login prompt if not authenticated
  if (!isLoggedIn || !userId) {
    return (
      <section className="flex-1 flex flex-col bg-gray-100 relative items-center justify-center">
        <div className="text-center p-8">
          <p className="text-gray-600 mb-4">{t('servicePage.chat.loginRequired') || 'Please log in to use chat'}</p>
          <a 
            href="/login" 
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {t('servicePage.chat.goToLogin') || 'Go to Login'}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 flex flex-col bg-gray-100 relative">
      {/* Connection status & Unread badge */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        {connectionStatus === 'disconnected' && (
          <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            Reconnecting...
          </div>
        )}
        {connectionStatus === 'connecting' && (
          <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            Connecting...
          </div>
        )}
        {unreadCount > 0 && (
          <div className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>

      {/* Typing indicator */}
      {isTyping && (
        <div className="absolute top-12 left-4 z-10 bg-white px-3 py-2 rounded-lg shadow-md text-sm text-gray-600">
          Admin is typing...
        </div>
      )}

      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 py-4 space-y-4 overflow-y-auto px-2 scroll-smooth"
        style={{ maxHeight: 'calc(100vh - 300px)' }}
      >
        {loadingMore && (
          <div className="flex items-center justify-center py-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">
              {t('servicePage.chat.initialBotMessage')}
            </p>
          </div>
        ) : (
          messages
            .filter((msg) => {
              // Filter messages to only show current conversation
              // If message has conversationId, it must match current conversationId
              if (msg.conversationId !== undefined) {
                return msg.conversationId === conversationId;
              }
              // If no conversationId, assume it's for current conversation (backward compatibility)
              return true;
            })
            .map((msg) => (
              <ChatMessage
                key={msg.id}
                from={msg.senderType === 'admin' ? 'bot' : 'user'}
                text={msg.content || ''}
                imageUrl={msg.imageUrl}
                timestamp={msg.createdAt}
              />
            ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 pb-3 bg-white border-t">
        <div className="flex items-center gap-2">
          {/* Image upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            title="Upload image"
          >
            {uploading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          <div className="flex-1 flex items-center bg-white rounded-full shadow-md px-3 py-2">
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Emit typing indicator
                if (socket && conversationId && e.target.value.length > 0) {
                  socket.emit('typing', { conversationId, isTyping: true });
                  
                  // Clear previous timeout
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                  }
                  
                  // Stop typing after 1s of inactivity
                  typingTimeoutRef.current = setTimeout(() => {
                    if (socket && conversationId) {
                      socket.emit('typing', { conversationId, isTyping: false });
                    }
                  }, 1000);
                }
              }}
              onKeyPress={handleKeyPress}
              placeholder={t('servicePage.chat.inputPlaceholder')}
              className="flex-1 text-sm bg-transparent outline-none px-1 text-black"
              disabled={!conversationId}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || !conversationId}
              className="ml-2 px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('servicePage.chat.sendButton')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
