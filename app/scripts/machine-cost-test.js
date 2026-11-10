// Missing machine totals must never be mistaken for recorded zeroes.
import assert from 'node:assert/strict';
import { numericCost, needsMachineCosts, fillMissingMachineCosts, clearUntrustedMachineCosts } from '../public/machine-cost.js';

for (const value of [null, undefined, '', '  ', 'NaN', Infinity, -1, false, {}]) assert.equal(numericCost(value), null);
assert.equal(numericCost(0), 0);
assert.equal(numericCost('0.00'), 0);
assert.equal(numericCost('12.50'), 12.5);
const rows = [
  { id: 1, total_hours: 2 }, { id: 2, total_service_cost: null, cost_basis: 'parts' },
  { id: 3, total_service_cost: 0, cost_basis: 'parts' }, { id: 4, total_service_cost: 99, cost_basis: 'parts' },
];
assert.ok(needsMachineCosts(rows));
const filled = fillMissingMachineCosts(rows, [
  { equipment_id: 1, status: 'open', cost_basis: 'parts', cost: 12.34 },
  { equipment_id: 1, status: 'done', cost_basis: 'parts', cost: '7.66' },
  { equipment_id: 2, status: 'in_progress', cost_basis: 'parts', cost: 3.45 },
  { equipment_id: 4, cost_basis: 'parts', cost: 100 }, // an existing machine total is authoritative
]);
assert.deepEqual(filled.map((m) => m.total_service_cost), [20, 3.45, 0, 99]);
assert.equal(rows[0].total_service_cost, undefined); // no input mutation
assert.ok(!needsMachineCosts(filled));
assert.equal(fillMissingMachineCosts([{ id: 5 }], [])[0].total_service_cost, 0);
assert.equal(clearUntrustedMachineCosts([{ id: 1, total_service_cost: 999 }])[0].total_service_cost, null);
assert.equal(fillMissingMachineCosts([{ id: 1, total_service_cost: 999 }], [{ equipment_id: 1, cost_basis: 'parts', cost: 5 }])[0].total_service_cost, 5);
assert.throws(() => fillMissingMachineCosts([{ id: 1 }], [{ equipment_id: 1, cost: 500 }])); // old labour-inclusive server
for (const jobs of [null, [{ equipment_id: 1 }], [{ equipment_id: null, cost: 3 }], [{ equipment_id: 1, cost: NaN }]]) {
  assert.throws(() => fillMissingMachineCosts([{ id: 1 }], jobs));
}
console.log('Machine-cost compatibility and incomplete-data tests passed');
