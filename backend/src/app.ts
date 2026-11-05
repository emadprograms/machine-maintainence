import express from 'express';
import cors from 'cors';
import equipmentRoutes from './routes/equipment.js';
import faultRoutes from './routes/faults.js';
import sparePartRoutes from './routes/spareparts.js';
import notificationRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';
import userRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import { requireAuth } from './middleware/authGuard.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.use('/api/auth', authRoutes);
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', requireAuth);
  app.use('/api/equipment', equipmentRoutes);
  app.use('/api/faults', faultRoutes);
  app.use('/api/spare-parts', sparePartRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/admin', adminRoutes);

  return app;
}
