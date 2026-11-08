// A report becomes evidence once its first stage exists. Stage corrections and
// closure have their own routes/fields and remain available.
import { get } from './db.js';
export const reportLocked = (workId) => Boolean(get('SELECT id FROM work_order_updates WHERE work_order_id = ? LIMIT 1', workId));
export const lockedReportFields = (body) => ['title', 'priority', 'reported_by', 'notes', 'stops_machine']
  .some((key) => Object.hasOwn(body, key));
export const reportLockMessage = 'The original work order cannot be edited after work has started. Add a stage update instead.';
