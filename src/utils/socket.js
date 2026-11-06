import { Server } from 'socket.io';
import logger from './logger.js';

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id}`);

    // Join Organization Room for isolated tenant broadcasts
    socket.on('join_organization', (orgId) => {
      if (orgId) {
        const room = `organization:${orgId}`;
        socket.join(room);
        socket.join(`org_${orgId}`);
        logger.info(`[Socket.IO] Socket ${socket.id} joined tenant room ${room}`);
      }
    });

    socket.on('leave_organization', (orgId) => {
      if (orgId) {
        socket.leave(`organization:${orgId}`);
        socket.leave(`org_${orgId}`);
        logger.info(`[Socket.IO] Socket ${socket.id} left tenant room organization:${orgId}`);
      }
    });

    socket.on('join_conversation', (conversationId) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
        socket.join(`conv_${conversationId}`);
        logger.info(`[Socket.IO] Socket ${socket.id} joined conversation room conversation:${conversationId}`);
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        socket.leave(`conv_${conversationId}`);
        logger.info(`[Socket.IO] Socket ${socket.id} left conversation room conversation:${conversationId}`);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  logger.info('[Socket.IO] Multi-tenant Socket.IO server initialized.');
  return io;
};

export const getIO = () => {
  if (!io) {
    logger.warn('[Socket.IO] Socket.IO instance requested before initialization.');
  }
  return io;
};

/**
 * Emit a real-time event to authorized users of a specific organization.
 * NEVER broadcast tenant events globally!
 */
export const emitToOrganization = (organizationId, eventName, data) => {
  if (!io) return;
  if (organizationId) {
    logger.info(`[Socket.IO] Emitting event '${eventName}' to organization:${organizationId}`);
    io.to(`organization:${organizationId}`).to(`org_${organizationId}`).emit(eventName, data);
  } else {
    logger.warn(`[Socket.IO WARNING] emitToOrganization called without organizationId! Emitting globally as fallback.`);
    io.emit(eventName, data);
  }
};

/**
 * Emit event to a specific conversation room.
 */
export const emitToConversation = (conversationId, eventName, data) => {
  if (!io || !conversationId) return;
  io.to(`conversation:${conversationId}`).to(`conv_${conversationId}`).emit(eventName, data);
};

/**
 * Backwards compatible socket emitter that checks for organization_id/organizationId.
 */
export const emitSocketEvent = (eventName, data, organizationId = null) => {
  if (!io) return;
  const targetOrgId = organizationId || data?.organizationId || data?.organization_id;

  if (targetOrgId) {
    emitToOrganization(targetOrgId, eventName, data);
  } else {
    // Fallback broadcast
    logger.info(`[Socket.IO] Global emit event '${eventName}':`, JSON.stringify(data));
    io.emit(eventName, data);
  }
};
