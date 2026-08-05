const path = require('path');

// App initialization
const app = require('express')();
const http = require('http').createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 3600
};

// Enable CORS
app.use(cors(corsOptions));

// Security headers
app.use(helmet());

// Body parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'A1-Recharge-Admin-API'
  });
});

// CORS preflight handling
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', corsOptions.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  res.sendStatus(204);
});

// Register API routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res, next) => {
  next(createNotFoundError('Route not found'));
});

// Error handling
app.use(errorHandler);

// Initialize server
const PORT = process.env.PORT || 3000;
const DB_CONNECTION = process.env.MONGO_URI;

// Start server
http.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   MongoDB: ${DB_CONNECTION.split('/').pop().split('?')[0]}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  http.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  http.close();
  process.exit(0);
});

// Export modules
module.exports = {
  app,
  http,
  corsOptions,
  errorHandler
};