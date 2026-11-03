// Sets a new password for one login, from the terminal (for when nobody can sign in to change it).
// Usage, with the app stopped:   npm run set-password -- admin
// The password is asked for and not shown; it is never passed on the command line.
const fs = require('fs');
const net = require('net');
const path = require('path');
const readline = require('readline');

const dataFile = path.resolve(__dirname, '..', 'krs_finance_data.json');
const sessionsFile = path.resolve(__dirname, '..', 'krs_sessions.json');
const login = (process.argv[2] || '').trim().toLowerCase();
const port = Number(process.env.PORT) || 3001;

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** The running app keeps the data in memory and would write the old password back. */
function appIsRunning() {
  return new Promise(resolve => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = text => { if (text.includes(question)) process.stdout.write(text); };
    rl.question(question, answer => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

(async () => {
  if (!login) fail('Give the user ID, for example:  npm run set-password -- admin');
  if (await appIsRunning()) fail(`The app is running (port ${port}). Stop it first, then run this again.`);

  const db = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const user = (db.users || []).find(u => String(u.username).toLowerCase() === login);
  if (!user) fail(`No login with the user ID "${login}".`);

  const min = user.role === 'ADMIN' ? 6 : 4;
  const first = await askHidden(`New password for ${user.username} (${user.role}): `);
  if (first.length < min) fail(`The password needs at least ${min} characters.`);
  const again = await askHidden('Type it again: ');
  if (again !== first) fail('The two passwords are different. Nothing was changed.');

  user.password = first;
  user.is_active = true;
  fs.writeFileSync(dataFile, JSON.stringify(db, null, 2), 'utf8');

  // Old sign-ins of this login stop working.
  try {
    const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
    fs.writeFileSync(sessionsFile, JSON.stringify(sessions.filter(([, s]) => s.userId !== user.id)));
  } catch {
    // No sessions file yet.
  }
  console.log(`Password changed for ${user.username}. Start the app and sign in with it.`);
})();
