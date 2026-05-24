#!/usr/bin/env node
// key-mark.mjs - Marca chave em cooldown (429) ou banned (403).
//
// Usage:
//   node key-mark.mjs cooldown <KEY_ID> [seconds]   # default 3600s (1h)
//   node key-mark.mjs banned <KEY_ID>               # permanente, requer pool-prune depois
//   node key-mark.mjs clear <KEY_ID>                # remove cooldown/banned, volta a active
//
// Faz backup do pool antes de modificar. Nao imprime valores das keys.

import fs from 'fs';
import path from 'path';

function normalizeHome() {
    let home = process.env.HOME || process.env.USERPROFILE;
    if (home && home.startsWith('/c/')) home = home.replace('/c/', 'C:\\');
    return home;
}

const KEYS_FILE = path.join(normalizeHome(), '.pi', 'agent', 'ai_studio_keys.json');

const [, , action, keyId, arg] = process.argv;

if (!action || !keyId) {
    process.stderr.write('Usage:\n');
    process.stderr.write('  node key-mark.mjs cooldown <KEY_ID> [seconds]   # default 3600\n');
    process.stderr.write('  node key-mark.mjs banned <KEY_ID>\n');
    process.stderr.write('  node key-mark.mjs clear <KEY_ID>\n');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
if (!data.pool || !data.pool[keyId]) {
    process.stderr.write(`ERRO: ${keyId} nao existe no pool.\n`);
    process.exit(1);
}

// Backup
const backup = KEYS_FILE.replace(/\.json$/, `.bak.${Date.now()}.json`);
fs.copyFileSync(KEYS_FILE, backup);

const entry = data.pool[keyId];
const nowIso = new Date().toISOString();

switch (action) {
    case 'cooldown': {
        const secs = parseInt(arg || '3600', 10);
        entry.cooldown_until = Date.now() + secs * 1000;
        entry.cooldown_set_at = nowIso;
        console.log(`${keyId}: cooldown ${secs}s (ate ${new Date(entry.cooldown_until).toISOString()})`);
        break;
    }
    case 'banned': {
        entry.status = 'banned';
        entry.banned_at = nowIso;
        entry.reason = arg || 'manual';
        console.log(`${keyId}: BANNED (${entry.reason}). Use 'node key-pool-prune.mjs' para remover.`);
        break;
    }
    case 'clear': {
        delete entry.cooldown_until;
        delete entry.cooldown_set_at;
        if (entry.status === 'banned') {
            entry.status = 'active';
            delete entry.banned_at;
            delete entry.reason;
            console.log(`${keyId}: restaurada para active.`);
        } else {
            console.log(`${keyId}: cooldown limpo.`);
        }
        break;
    }
    default:
        process.stderr.write(`ERRO: acao desconhecida '${action}'. Use cooldown/banned/clear.\n`);
        process.exit(1);
}

fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
console.log(`Backup: ${backup}`);
