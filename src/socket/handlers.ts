import { Server, Socket } from 'socket.io';
import { logger } from '../config/logger';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

interface SocketUser {
  userId: string;
  socketId: string;
  isOnline: boolean;
  lastSeen: Date;
}

// Store online users
const onlineUsers = new Map<string, SocketUser>();

// Authenticate socket connection
const authenticateSocket = async (socket: AuthenticatedSocket, next: Function) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    
    // Verify JWT token
    const decoded = jwt.verify(cleanToken, config.jwt.secret) as any;
    
    // Check if user exists and is active
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return next(new Error('Invalid or inactive user'));
    }

    // Attach user info to socket
    socket.userId = user._id.toString();
    socket.user = user;
    
    next();
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Socket authentication failed:', { error: error.message });
    } else {
      logger.error('Socket authentication failed:', { error });
    }
    next(new Error('Authentication failed'));
  }
};

// Setup socket handlers
export const setupSocketHandlers = (io: Server) => {
  // Use authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const user = socket.user!;

    logger.info('User connected to socket:', {
      userId,
      email: user.email,
      socketId: socket.id
    });

    // Add user to online users
    onlineUsers.set(userId, {
      userId,
      socketId: socket.id,
      isOnline: true,
      lastSeen: new Date()
    });

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Join user to admin room if they are admin
    if (['admin', 'super_admin'].includes(user.role)) {
      socket.join('admin');
    }

    // Handle user typing in chat
    socket.on('typing:start', (data: { roomId: string }) => {
      socket.to(data.roomId).emit('typing:start', {
        userId,
        userName: `${user.firstName} ${user.lastName}`
      });
    });

    socket.on('typing:stop', (data: { roomId: string }) => {
      socket.to(data.roomId).emit('typing:stop', { userId });
    });

    // Handle chat messages
    socket.on('chat:message', (data: { roomId: string; message: string }) => {
      const messageData = {
        id: Date.now().toString(),
        userId,
        userName: `${user.firstName} ${user.lastName}`,
        message: data.message,
        timestamp: new Date().toISOString(),
        roomId: data.roomId
      };

      // Broadcast message to room
      io.to(data.roomId).emit('chat:message', messageData);

      // Log message
      logger.info('Chat message sent:', {
        roomId: data.roomId,
        userId,
        messageLength: data.message.length
      });
    });

    // Handle order status updates
    socket.on('order:status_update', (data: { orderId: string; status: string }) => {
      // Emit to user's personal room
      io.to(`user:${userId}`).emit('order:status_update', {
        orderId: data.orderId,
        status: data.status,
        timestamp: new Date().toISOString()
      });

      // Emit to admin room if status needs attention
      if (['pending', 'processing', 'shipped'].includes(data.status)) {
        io.to('admin').emit('order:status_update', {
          orderId: data.orderId,
          status: data.status,
          userId,
          userName: `${user.firstName} ${user.lastName}`,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle product updates
    socket.on('product:update', (data: { productId: string; action: string }) => {
      // Emit to admin room for product updates
      io.to('admin').emit('product:update', {
        productId: data.productId,
        action: data.action,
        userId,
        userName: `${user.firstName} ${user.lastName}`,
        timestamp: new Date().toISOString()
      });
    });

    // Handle inventory updates
    socket.on('inventory:update', (data: { productId: string; quantity: number }) => {
      // Emit to admin room for inventory updates
      io.to('admin').emit('inventory:update', {
        productId: data.productId,
        quantity: data.quantity,
        userId,
        userName: `${user.firstName} ${user.lastName}`,
        timestamp: new Date().toISOString()
      });
    });

    // Handle user presence
    socket.on('presence:update', (data: { status: 'online' | 'away' | 'offline' }) => {
      const userInfo = onlineUsers.get(userId);
      if (userInfo) {
        userInfo.isOnline = data.status === 'online';
        userInfo.lastSeen = new Date();
        
        // Broadcast presence update to relevant rooms
        io.to(`user:${userId}`).emit('presence:update', {
          userId,
          status: data.status,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle private messages
    socket.on('message:private', (data: { recipientId: string; message: string }) => {
      const recipientInfo = onlineUsers.get(data.recipientId);
      
      if (recipientInfo && recipientInfo.isOnline) {
        // Send to recipient
        io.to(recipientInfo.socketId).emit('message:private', {
          senderId: userId,
          senderName: `${user.firstName} ${user.lastName}`,
          message: data.message,
          timestamp: new Date().toISOString()
        });

        // Send confirmation to sender
        socket.emit('message:private:sent', {
          recipientId: data.recipientId,
          timestamp: new Date().toISOString()
        });
      } else {
        // Recipient is offline
        socket.emit('message:private:failed', {
          recipientId: data.recipientId,
          reason: 'User is offline',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info('User disconnected from socket:', {
        userId,
        email: user.email,
        socketId: socket.id
      });

      // Update user status
      const userInfo = onlineUsers.get(userId);
      if (userInfo) {
        userInfo.isOnline = false;
        userInfo.lastSeen = new Date();
      }

      // Leave all joined rooms except the default personal room (socket.id)
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.leave(room);
        }
      }
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      logger.error('Socket error:', {
        userId,
        socketId: socket.id,
        error: error.message
      });
    });
  });

  // Handle server-wide events
  io.on('error', (error: Error) => {
    logger.error('Socket.IO server error:', { error: error.message });
  });

  // Broadcast to all connected clients
  io.on('broadcast', (event: string, data: any) => {
    io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  });

  // Broadcast to specific room
  io.on('room:broadcast', (room: string, event: string, data: any) => {
    io.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  });
};

// Utility functions for external use
export const getOnlineUsers = (): SocketUser[] => {
  return Array.from(onlineUsers.values());
};

export const getUserSocket = (userId: string): SocketUser | undefined => {
  return onlineUsers.get(userId);
};

export const isUserOnline = (userId: string): boolean => {
  const userInfo = onlineUsers.get(userId);
  return userInfo ? userInfo.isOnline : false;
};

export const broadcastToUser = (io: Server, userId: string, event: string, data: any) => {
  const userInfo = onlineUsers.get(userId);
  if (userInfo && userInfo.isOnline) {
    io.to(userInfo.socketId).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }
};

export const broadcastToRoom = (io: Server, room: string, event: string, data: any) => {
  io.to(room).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

export default setupSocketHandlers;
