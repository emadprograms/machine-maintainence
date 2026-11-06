// Reset a forgotten password — the way back in that did not exist.
//
// Stop the app (Ctrl+C in its window), then in this folder:
//
//   node reset-password.js                      new password for admin@local
//   node reset-password.js --password Shop2026  choose it yourself
//   node reset-password.js --email sam@workshop someone else
//
// Nothing is deleted except the sign-in sessions, which is deliberate: whoever
// is resetting may be recovering from a password someone else knows.
import { all, get, run, forgetFirstPassword } from './db.js';
import { DB_PATH } from './db.js';
import { hashPassword, randomPassword } from './auth.js';
import { revokeAll } from './sessions.js';

const args = process.argv.slice(2);

function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
}

const email = String(flag('email') || 'admin@local').trim().toLowerCase();
const chosen = flag('password');

const user = get('SELECT id, email, active FROM users WHERE email = ?', email);
if (!user) {
  console.error(`\n  There is no account with the email "${email}".`);
  const known = all('SELECT email FROM users ORDER BY id');
  if (known.length === 0) {
    console.error('  This database has no accounts at all. Start the app:');
    console.error('  it will create the first one and print its password.\n');
  } else {
    console.error('  The accounts in this database are:');
    for (const u of known) console.error(`    ${u.email}`);
    console.error('');
  }
  process.exit(1);
}

if (chosen !== null && String(chosen).length < 8) {
  console.error('\n  A password must be at least 8 characters.\n');
  process.exit(1);
}

const password = chosen === null ? randomPassword() : String(chosen);

run('UPDATE users SET password_hash = ?, active = 1 WHERE id = ?',
  hashPassword(password), user.id);
revokeAll();
// The note beside the database holds the original password, which no longer
// works. Leaving it would be a live password in a text file.
if (email === 'admin@local') forgetFirstPassword();

console.log(`\n  ${email} can sign in again.`);
if (chosen === null) console.log(`  New password: ${password}`);
console.log('  Every open session was signed out.');
console.log(`  Database: ${DB_PATH}\n`);
