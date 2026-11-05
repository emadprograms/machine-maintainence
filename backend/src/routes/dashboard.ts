import { Router, Request, Response } from 'express';
import { queryAll, queryOne } from '../database.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const totalEquipment = (queryOne('SELECT COUNT(*) as count FROM equipment') as any)?.count || 0;
  const activeFaults = (queryOne("SELECT COUNT(*) as count FROM faults WHERE status != 'closed'") as any)?.count || 0;
  const closedFaults = (queryOne("SELECT COUNT(*) as count FROM faults WHERE status = 'closed'") as any)?.count || 0;
  const pendingParts = (queryOne("SELECT COUNT(*) as count FROM spare_parts WHERE status IN ('pending','ordered')") as any)?.count || 0;
  const criticalFaults = (queryOne("SELECT COUNT(*) as count FROM faults WHERE priority = 'critical' AND status != 'closed'") as any)?.count || 0;
  const avgHealth = (queryOne("SELECT COALESCE(ROUND(AVG(health_score), 1), 0) as avg FROM equipment WHERE status = 'active'") as any)?.avg || 0;

  const faultsByStatus = queryAll('SELECT status, COUNT(*) as count FROM faults GROUP BY status');
  const faultsByPriority = queryAll('SELECT priority, COUNT(*) as count FROM faults GROUP BY priority');
  const equipmentByCategory = queryAll('SELECT category, COUNT(*) as count FROM equipment GROUP BY category');

  const recentFaults = queryAll(`
    SELECT f.*, e.name as equipment_name FROM faults f
    LEFT JOIN equipment e ON f.equipment_id = e.id
    ORDER BY f.created_at DESC LIMIT 5
  `);

  const statusFlow = queryAll(`
    SELECT status, COUNT(*) as count FROM faults GROUP BY status
    ORDER BY CASE status
      WHEN 'submitted' THEN 1 WHEN 'analysis' THEN 2 WHEN 'inspection' THEN 3
      WHEN 'validation' THEN 4 WHEN 'manufacturing' THEN 5 WHEN 'delivery' THEN 6 WHEN 'closed' THEN 7
    END
  `);

  const lowHealthEquipment = queryAll(
    'SELECT id, name, health_score FROM equipment WHERE health_score < 60 ORDER BY health_score ASC LIMIT 5'
  );

  res.json({
    totalEquipment,
    activeFaults,
    closedFaults,
    pendingParts,
    criticalFaults,
    avgHealth,
    faultsByStatus,
    faultsByPriority,
    equipmentByCategory,
    recentFaults,
    statusFlow,
    lowHealthEquipment,
  });
});

export default router;
