import fs from 'fs';
import os from 'os';
import path from 'path';

function normalizeHome() {
    let home = process.env.HOME || process.env.USERPROFILE;
    if (home && home.startsWith('/c/')) home = home.replace('/c/', 'C:\\');
    return home;
}

const KEYS_FILE = path.join(normalizeHome(), '.pi', 'agent', 'ai_studio_keys.json');
const BACKUP = KEYS_FILE.replace(/\.json$/, `.bak.${Date.now()}.json`);

const data = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
const pool = data.pool || {};
const before = Object.entries(pool);
const banned = before.filter(([, v]) => v.status === 'banned').map(([id]) => id);

if (banned.length === 0) {
    console.log('Nenhuma chave banida. Nada a fazer.');
    process.exit(0);
}

// Backup
fs.copyFileSync(KEYS_FILE, BACKUP);

// Remover banned
const newPool = {};
for (const [id, v] of before) {
    if (v.status !== 'banned') newPool[id] = v;
}
data.pool = newPool;

fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));

console.log(`Backup salvo em: ${BACKUP}`);
console.log(`Removidas: ${banned.join(', ')}`);
console.log(`Pool antes: ${before.length} | depois: ${Object.keys(newPool).length}`);
console.log(`Ativas restantes: ${Object.entries(newPool).filter(([, v]) => v.status === 'active').length}`);
