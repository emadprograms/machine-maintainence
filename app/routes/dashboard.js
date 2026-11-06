// One request, four answers, for the landing screen: work due, stock low,
// machines out of service, and what is open. Kept on the server so the screen
// stays a renderer rather than a calculator.

import { send, route } from '../http.js';
import { all } from '../db.js';
import { workOrderFilter } from '../filters.js';
import { monthlyTrend } from '../trend.js';
import { downMachines } from '../status.js';

export default {
  // ---- dashboard. One request, four answers.
  //
  // The alternative was four existing list calls and a client that counts. That
  // puts the answer in the one place this project cannot test — the smoke suite
  // has no DOM — and ships four payloads to render four numbers. Every query here
  // reuses a predicate the owning screen already uses, so a card cannot disagree
  // with the list it links to.
  'GET /api/dashboard': route(async (_req, res) => {
    const DUE_DAYS = 7;      // the first option on the Due soon screen
    const CAP = 5;           // enough to act on; the card links to the rest

    const openWork = workOrderFilter({});
    const openFilter = openWork.sql
      ? `${openWork.sql} AND w.status <> 'done'`
      : `WHERE w.status <> 'done'`;

    const work = all(`
      SELECT w.id, w.title, w.priority, w.status, e.name AS equipment_name
      FROM work_orders w JOIN equipment e ON e.id = w.equipment_id
      ${openFilter}
      ORDER BY CASE w.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
               w.created_at ASC`);
    const dueRows = all(`
      SELECT p.id, p.task, p.next_due, e.name AS equipment_name,
             CAST(julianday(p.next_due) - julianday('now') AS INTEGER) AS days_left
      FROM pm_schedule p JOIN equipment e ON e.id = p.equipment_id
      WHERE julianday(p.next_due) <= julianday('now', '+' || ? || ' days')
      ORDER BY p.next_due`, DUE_DAYS);
    const lowRows = all(`
      SELECT part.id, part.name, part.qty, part.reorder_level
      FROM parts part WHERE part.qty <= part.reorder_level
      ORDER BY (part.qty - part.reorder_level) ASC`);
    // Not a second opinion: the same derivation the Machines screen uses, so the
    // card and the list cannot disagree about which machines are out of service.
    const downRows = downMachines();

    // The count is always the true total; only the list is capped. Capping the
    // count as well would make a card say "5" when 40 parts are low.
    const section = (rows, items, href) => ({
      count: rows.length,
      items: items.slice(0, CAP),
      href,
    });

    send(res, 200, {
      work_orders: section(work, work, '#work'),
      due_soon: section(dueRows, dueRows, '#due'),
      low_stock: section(lowRows, lowRows, '#parts'),
      machines: section(downRows, downRows, '#equipment'),
      // The charts. Same request as the cards: one load, one error state, and no
      // way for a bar to describe a different workshop than the numbers above it.
      charts: { trend: monthlyTrend(6) },
    });
  }),



  // "Mark done": rolls next_due forward by the interval. One line of SQL, no fake dates.

  // Names only, for populating an assignment dropdown. Any signed-in user may call
  // this — a technician has to be able to say who owns a job. It deliberately
  // exposes id and name and nothing else, so it cannot become the staff-directory
  // leak that bug #11 closed (T-8-01).
};
