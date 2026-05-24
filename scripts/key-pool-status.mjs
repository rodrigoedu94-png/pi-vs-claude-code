import fs from 'fs';
import os from 'os';
import path from 'path';

function normalizeHome() {
    let home = process.env.HOME || process.env.USERPROFILE;
    if (home && home.startsWith('/c/')) home = home.replace('/c/', 'C:\\');
    return home;
}

const KEYS_FILE = path.join(normalizeHome(), '.pi', 'agent', 'ai_studio_keys.json');
const data = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
const pool = data.pool || {};
const entries = Object.entries(pool);

console.log(`Total chaves no pool: ${entries.length}`);
const active = entries.filter(([, v]) => v.status === 'active');
console.log(`Ativas: ${active.length}`);
console.log('Status por ID:');
for (const [id, v] of entries) {
    console.log(`  ${id}: ${v.status}${v.note ? ' ('+v.note+')' : ''}`);
}
