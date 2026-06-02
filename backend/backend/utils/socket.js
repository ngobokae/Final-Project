let io;

export const initSocket = (server) => {
  import('socket.io').then(({ Server }) => {
    io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      console.log('New client connected:', socket.id);
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    console.log('📶 Socket.io initialized');
  });
};

export const getIO = () => {
  if (!io) {
    // Return a dummy object if not initialized to prevent crashes
    return { emit: () => {} };
  }
  return io;
};
