#!/usr/bin/env node
// key-router.mjs - Smart key picker baseado em modelo solicitado.
// Usage: GEMINI_API_KEY=$(node scripts/key-router.mjs <model>) pi --model <model> ...
//
// Lê pool de chaves em ~/.pi/agent/ai_studio_keys.json (status='active')
// Lê histórico de uso em ~/.pi/agent/key-usage.json
// Escolhe chave com MAIS cota restante (RPD) para o modelo pedido.
// Registra incremento de uso para a chave escolhida.
//
// Cotas oficiais RPD por chave (free tier AI Studio, dashboard real):
const QUOTAS_RPD = {
    'gemini-2.5-flash': 20,
    'gemini-2.5-flash-lite': 20,
    'gemini-2.5-pro': 0,        // tier pago
    'gemini-3-flash': 20,
    'gemini-3-flash-preview': 20,
    'gemini-3.5-flash': 20,
    'gemini-3.1-flash-lite': 500,
    'gemini-3.1-flash-lite-preview': 500,
    'gemini-3.1-pro': 0,        // tier pago
    'gemma-4-26b-a4b-it': 1500,
    'gemma-4-31b-it': 1500,
    'gemma-3-27b-it': 1500,
};

// Limite SEGURO por chave/modelo/dia (mitigação anti-ban).
// Fonte: QUOTA_AND_BANS_CHEATSHEET (tuxevil/pi-antigravity-rotator):
// "~200 req/conta/24h dispara detecção de abuso, mesmo sem 429"
// Mantemos margem de seguranca: 100 req/chave/modelo/dia.
// Override via env: SAFE_LIMIT=150 node key-router.mjs <model>
const SAFE_LIMIT = parseInt(process.env.SAFE_LIMIT || '100', 10);

// Limite efetivo = min(cota oficial, limite seguro)
function effectiveLimit(model) {
    const official = QUOTAS_RPD[model] ?? 100;
    if (official === 0) return 0;  // tier pago - nao usar
    return Math.min(official, SAFE_LIMIT);
}

import fs from 'fs';
import path from 'path';

function normalizeHome() {
    let home = process.env.HOME || process.env.USERPROFILE;
    if (home && home.startsWith('/c/')) home = home.replace('/c/', 'C:\\');
    return home;
}

const HOME = normalizeHome();
const KEYS_FILE = path.join(HOME, '.pi', 'agent', 'ai_studio_keys.json');
const USAGE_FILE = path.join(HOME, '.pi', 'agent', 'key-usage.json');

function todayUTC() {
    return new Date().toISOString().slice(0, 10);
}

function loadUsage() {
    try {
        const raw = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
        const today = todayUTC();
        if (raw.date !== today) return { date: today, counts: {} };
        return raw;
    } catch {
        return { date: todayUTC(), counts: {} };
    }
}

function saveUsage(usage) {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
}

function pickKey(model) {
    const data = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
    const pool = data.pool || {};
    const usage = loadUsage();

    const limit = effectiveLimit(model);
    if (limit === 0) {
        process.stderr.write(`ERRO: ${model} requer tier pago ou nao tem cota free.\n`);
        process.exit(3);
    }
    const nowMs = Date.now();
    const candidates = Object.entries(pool)
        .filter(([, v]) => v.status === 'active')
        .filter(([id, v]) => {
            // Filtra chaves em cooldown (cooldown_until > now)
            if (v.cooldown_until && v.cooldown_until > nowMs) {
                const secs = Math.ceil((v.cooldown_until - nowMs) / 1000);
                process.stderr.write(`[key-router] skip ${id} (cooldown ${secs}s)\n`);
                return false;
            }
            return true;
        })
        .map(([id, v]) => {
            const used = (usage.counts[id]?.[model]) ?? 0;
            return { id, key: v.key, used, remaining: limit - used };
        })
        .filter(c => c.remaining > 0)
        .sort((a, b) => b.remaining - a.remaining); // mais cota primeiro

    if (candidates.length === 0) {
        process.stderr.write(`ERRO: nenhuma chave com cota segura disponivel para ${model} hoje (${todayUTC()})\n`);
        process.stderr.write(`Limite seguro por chave: ${limit} (oficial: ${QUOTAS_RPD[model]} RPD)\n`);
        const totals = Object.entries(pool)
            .filter(([, v]) => v.status === 'active')
            .map(([id, v]) => {
                const used = usage.counts[id]?.[model] ?? 0;
                const cool = v.cooldown_until && v.cooldown_until > nowMs ? ' (cooldown)' : '';
                return `${id}=${used}/${limit}${cool}`;
            })
            .join(', ');
        process.stderr.write(`Uso hoje: ${totals}\n`);
        process.exit(2);
    }

    const chosen = candidates[0];

    // registra uso
    if (!usage.counts[chosen.id]) usage.counts[chosen.id] = {};
    usage.counts[chosen.id][model] = (usage.counts[chosen.id][model] || 0) + 1;
    saveUsage(usage);

    // Alerta se chave atingiu >80% do limite seguro
    const used = chosen.used + 1;
    const pct = Math.round((used / limit) * 100);
    const warn = pct >= 80 ? ` ⚠️ ${pct}%` : '';
    process.stderr.write(`[key-router] ${chosen.id} -> ${model} (${used}/${limit} hoje${warn})\n`);
    process.stdout.write(chosen.key);
}

const model = process.argv[2];
if (!model) {
    process.stderr.write('Usage: node key-router.mjs <model>\n');
    process.stderr.write('Ex: node key-router.mjs gemini-3.5-flash\n');
    process.exit(1);
}

pickKey(model);
