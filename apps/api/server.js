const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');

const { initFirebaseAdmin } = require('./config/firebase');

// Load env vars
dotenv.config();

// Init Firebase Admin SDK
initFirebaseAdmin();

// Connect to database
connectDB();

// --- STARTUP PROTECTION ---
const fs = require('fs');
const serviceControllerCode = fs.readFileSync(path.join(__dirname, 'controllers/serviceController.js'), 'utf-8');
if (
  serviceControllerCode.includes('setTimeout') || 
  serviceControllerCode.includes('OP${Math.random') || 
  serviceControllerCode.includes('TXN${Math.random')
) {
  console.error('CRITICAL STARTUP ERROR: Mock recharge code detected in serviceController.js. Startup aborted.');
  process.exit(1);
}
// --- END STARTUP PROTECTION ---

const app = express();

const allowedOrigins = [
  'https://a1recharge.com',
  'https://staging.a1recharge.com',
  'https://a1recharge-admin.vercel.app',
  'https://a1recharge-admin.onrender.com',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or requests with no origin
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    
    // Allow Vercel preview/production deployments and Render backend domains
    if (/\.vercel\.app$/.test(origin) || /\.onrender\.com$/.test(origin)) return callback(null, true);
    
    // Allow local development origins
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Platform', 'X-App-Version', 'Accept', 'Origin', 'X-Requested-With', 'idempotency-key', 'Idempotency-Key'],
};

app.use(cors(corsOptions));
app.use(express.json());
// app.use(helmet());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/msg91', require('./routes/msg91Routes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/device', require('./routes/deviceRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/provider/a1topup', require('./routes/recharge.routes'));
app.use('/api/plans', require('./routes/plans.routes'));
app.use('/api/bank', require('./routes/bankRoutes'));
app.use('/api/kyc', require('./routes/kycRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/master', require('./routes/masterData.routes'));
app.use('/api/commission', require('./routes/commissionRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Serve uploaded KYC documents statically (protected by token in production
// via a signed-URL proxy; acceptable for local dev).
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'A1 Recharge API is running' });
});

// Error handling middleware (must be after routes)
app.use(errorHandler);

// Start the background workers
const pendingRechargeWorker = require('./workers/pendingRecharge.worker');
pendingRechargeWorker.start(2 * 60 * 1000); // Check every 2 minutes

const whatsappStatusWorker = require('./workers/whatsappStatusWorker');
whatsappStatusWorker.start();

const planapiSyncWorker = require('./workers/planapiSyncWorker');
planapiSyncWorker.start();

const planApiWalletMonitorWorker = require('./workers/planApiWalletMonitorWorker');
planApiWalletMonitorWorker.start();

const fast2SMSWalletMonitorWorker = require('./workers/fast2SMSWalletMonitorWorker');
fast2SMSWalletMonitorWorker.start();

const PORT = process.env.ADMIN_PORT || 5001;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] Admin connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket] Admin disconnected: ${socket.id}`);
  });
});

// Setup MongoDB Change Streams for real-time Live Feed
mongoose.connection.once('open', () => {
  const Transaction = require('./models/Transaction');
  
  const transactionStream = Transaction.watch([
    { $match: { operationType: 'insert' } }
  ]);

  transactionStream.on('change', async (change) => {
    try {
      const fullDocument = change.fullDocument;
      
      // We need to fetch the populated Retailer name
      const populatedTxn = await Transaction.findById(fullDocument._id)
        .populate('userId', 'retailerId name phone')
        .lean();

      if (populatedTxn) {
        io.emit('new_transaction', populatedTxn);
      }
    } catch (err) {
      console.error('Error emitting new transaction socket event:', err);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server & WebSocket running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
