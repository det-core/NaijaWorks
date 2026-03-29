// ============================================================
// NaijaWorks — Server Entry Point
// ============================================================

const app = require('./app');
const config = require('./config/config');

const PORT = config.server.port;

const server = app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║        NaijaWorks Server Started         ║');
  console.log(`  ║  Port    : ${PORT}                           ║`);
  console.log(`  ║  Mode    : ${config.server.nodeEnv.padEnd(28)}║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Closing gracefully...');
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received. Closing gracefully...');
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});
