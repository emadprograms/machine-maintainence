import { initDb, queryOne, execute, getDb } from './database.js';
import { v4 as uuid } from 'uuid';
import { hashPassword } from './lib/auth.js';
import { catalogImagesForEquipment, catalogImagesForFault } from './lib/imageCatalog.js';

export async function seedIfEmpty(): Promise<void> {
  await initDb();
  const admin = queryOne("SELECT id FROM users WHERE email = 'admin@maintainx.com'");
  if (admin) {
    console.log('Demo data already present.');
    return;
  }

  const users = [
    { id: uuid(), name: 'Admin', email: 'admin@maintainx.com', role: 'admin' },
    { id: uuid(), name: 'Sophie Martin', email: 'sophie@maintainx.com', role: 'manager' },
    { id: uuid(), name: 'Thomas Dubois', email: 'thomas@maintainx.com', role: 'technician' },
    { id: uuid(), name: 'Lucas Petit', email: 'lucas@maintainx.com', role: 'technician' },
  ];

  const defaultHash = hashPassword('demo1234');
  for (const u of users) {
    execute('INSERT INTO users (id, name, email, role, password) VALUES (?, ?, ?, ?, ?)', [u.id, u.name, u.email, u.role, defaultHash]);
  }

  const equipment = [
    { id: uuid(), name: 'Presse hydraulique 300T', category: 'Presses', description: 'Presse hydraulique principale de l\'atelier', location: 'Bâtiment A - Atelier 1', status: 'active', health_score: 82 },
    { id: uuid(), name: 'Convoyeur principal #1', category: 'Convoyeurs', description: 'Convoyeur d\'alimentation ligne 1', location: 'Bâtiment A - Ligne 1', status: 'active', health_score: 91 },
    { id: uuid(), name: 'Robot de soudure MIG-200', category: 'Robots', description: 'Robot de soudage automatique', location: 'Bâtiment B - Station 3', status: 'active', health_score: 65 },
    { id: uuid(), name: 'Compresseur à vis 75kW', category: 'Compresseurs', description: 'Compresseur d\'air principal', location: 'Bâtiment C - Local technique', status: 'maintenance', health_score: 45 },
    { id: uuid(), name: 'Centrifugeuse industrielle', category: 'Centrifugeuses', description: 'Centrifugeuse pour traitement chimique', location: 'Bâtiment B - Zone humide', status: 'active', health_score: 78 },
    { id: uuid(), name: 'Four de traitement thermique', category: 'Fours', description: 'Four à gaz pour traitement thermique', location: 'Bâtiment D', status: 'active', health_score: 88 },
  ];

  for (const e of equipment) {
    execute('INSERT INTO equipment (id, name, category, description, location, status, health_score, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [e.id, e.name, e.category, e.description, e.location, e.status, e.health_score, catalogImagesForEquipment(e.name, e.category)]);
  }

  const faults = [
    { id: uuid(), equipment_id: equipment[2].id, title: 'Bras articulé bloqué en position X', description: 'Le bras du robot reste bloqué en position X après un cycle de soudure. Code erreur E-47.', priority: 'critical', status: 'analysis', reported_by: users[3].id, equipment_name: equipment[2].name, equipment_category: equipment[2].category },
    { id: uuid(), equipment_id: equipment[3].id, title: 'Fuite d\'huile compresseur', description: 'Fuite d\'huile détectée au niveau du joint SPI. Perte estimée 2L/jour.', priority: 'high', status: 'inspection', reported_by: users[2].id, equipment_name: equipment[3].name, equipment_category: equipment[3].category },
    { id: uuid(), equipment_id: equipment[0].id, title: 'Vérin hydraulique défaillant', description: 'Le vérin principal montre des signes d\'usure avancée. Course irrégulière.', priority: 'high', status: 'submitted', reported_by: users[3].id, equipment_name: equipment[0].name, equipment_category: equipment[0].category },
    { id: uuid(), equipment_id: equipment[4].id, title: 'Bruit anormal au démarrage', description: 'Bruit de frottement métallique lors du démarrage de la centrifugeuse.', priority: 'medium', status: 'validation', reported_by: users[2].id, equipment_name: equipment[4].name, equipment_category: equipment[4].category },
    { id: uuid(), equipment_id: equipment[1].id, title: 'Rouleau convoyeur endommagé', description: 'Le rouleau d\'entraînement n°4 présente une usure anormale.', priority: 'low', status: 'closed', reported_by: users[2].id, equipment_name: equipment[1].name, equipment_category: equipment[1].category },
  ];

  for (const f of faults) {
    execute('INSERT INTO faults (id, equipment_id, title, description, priority, status, images, reported_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [f.id, f.equipment_id, f.title, f.description, f.priority, f.status, catalogImagesForFault(f.title, f.description, f.equipment_name, f.equipment_category, f.priority), f.reported_by]);
  }

  const spareParts = [
    { id: uuid(), fault_id: faults[0].id, name: 'Capteur de position inductif', reference: 'CP-200-X', quantity: 2, unit_price: 45, supplier: 'Siemens', status: 'ordered' },
    { id: uuid(), fault_id: faults[1].id, name: 'Joint SPI 35x52x8', reference: 'SPI-355208', quantity: 3, unit_price: 8.5, supplier: 'SKF', status: 'pending' },
    { id: uuid(), fault_id: faults[2].id, name: 'Vérin hydraulique double effet', reference: 'VH-DE-200x500', quantity: 1, unit_price: 1250, supplier: 'Bosch Rexroth', status: 'pending' },
  ];

  for (const p of spareParts) {
    execute('INSERT INTO spare_parts (id, fault_id, name, reference, quantity, unit_price, supplier, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [p.id, p.fault_id, p.name, p.reference, p.quantity, p.unit_price, p.supplier, p.status]);
  }

  const activities = [
    { id: uuid(), type: 'fault_created', message: 'Panne critique signalée : Bras articulé bloqué', related_id: faults[0].id, related_type: 'fault', user_id: users[3].id },
    { id: uuid(), type: 'status_change', message: 'Panne "Bras articulé bloqué" passée en Analyse', related_id: faults[0].id, related_type: 'fault', user_id: users[0].id },
    { id: uuid(), type: 'part_ordered', message: '2x Capteur de position commandé pour panne #1', related_id: spareParts[0].id, related_type: 'spare_part', user_id: users[1].id },
  ];

  for (const a of activities) {
    execute('INSERT INTO activities (id, type, message, related_id, related_type, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [a.id, a.type, a.message, a.related_id, a.related_type, a.user_id]);
  }

  console.log('Demo data seeded.');
}

if (process.argv[1]?.includes('seed')) {
  seedIfEmpty().catch(console.error);
}
