/**
 * spawnPiWrapper — shared helper for spawning child Pi processes on Windows
 *
 * Solves the multi-layer Windows spawn problem documented in agent-team.ts:
 * - shell:true (cmd.exe) reparses long args breaking with "Unknown option: -"
 * - shell:bash interprets markdown as code: "syntax error near ("
 * - shell:false direct .cmd → EINVAL (Node 18.20+ CVE-2024-27980)
 *
 * Solution: write content to temp files, generate a bash wrapper script that
 * uses $(cat file) to inject long content, spawn bash on the wrapper.
 * Args reaching the kernel are minimal — no shell reparsing of markdown.
 *
 * Used by:
 * - extensions/agent-team.ts (dispatch_agent → subagent)
 * - extensions/subagent-widget.ts (/sub → background subagent)
 */

import { spawn, ChildProcess } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

// ── Shell-quote: escape arbitrary string for inclusion in single-quoted bash ──
//
// Bash single-quoted strings have no escapes EXCEPT 'closing-opening: ' → '\''.
// Pattern: 'foo'\''bar'  →  bash sees: foo'bar
// Safe for any input including newlines, $, backticks, etc.
export function shq(s: string): string {
	return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

// ── Bash discovery: ordered fallback list, cached after first hit ──
//
// PI_BASH env var wins. Then common Windows Git Bash locations.
// Fails loudly if none found — better than silent ENOENT later.
let _bashCache: string | null = null;
const BASH_CANDIDATES_WIN = [
	"C:/Program Files/Git/bin/bash.exe",
	"C:/Program Files (x86)/Git/bin/bash.exe",
	`${process.env.USERPROFILE || ""}/scoop/apps/git/current/bin/bash.exe`,
	`${process.env.LOCALAPPDATA || ""}/Programs/Git/bin/bash.exe`,
];

export function findBash(): string {
	if (_bashCache) return _bashCache;

	if (process.env.PI_BASH && existsSync(process.env.PI_BASH)) {
		_bashCache = process.env.PI_BASH;
		return _bashCache;
	}

	if (process.platform !== "win32") {
		_bashCache = "/bin/bash";
		return _bashCache;
	}

	for (const p of BASH_CANDIDATES_WIN) {
		if (p && existsSync(p)) {
			_bashCache = p;
			return p;
		}
	}

	throw new Error(
		`bash not found. Tried: PI_BASH env, ${BASH_CANDIDATES_WIN.join(", ")}. Set PI_BASH to your bash.exe path.`,
	);
}

// ── Unique id: timestamp + 4 random bytes ──
//
// Prevents collision when same agent is dispatched concurrently
// (Promise.all from primary, or two /sub in same ms).
function genId(): string {
	return `${Date.now()}-${randomBytes(4).toString("hex")}`;
}

// ── Sanitize agent name for safe filename ──
function safeFilename(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9_-]+/g, "_") || "agent";
}

// ── Main spawn: write prompt + wrapper, spawn bash, auto-cleanup ──

export interface SpawnPiOpts {
	/** Agent name (for filename + logging). Sanitized to a-z0-9_-. */
	agentName: string;
	/** Long content (system prompt or message). Goes to /tmp file, injected via $(cat). */
	promptContent: string;
	/** CLI flags BEFORE the prompt injection. Each item is one arg, will be shell-escaped. */
	cliFlags: string[];
	/**
	 * How to inject the prompt content into the pi command:
	 * - "append-system-prompt": pi --append-system-prompt "$(cat <file>)"
	 * - "message": pi ... "$(cat <file>)"   (prompt is the final positional arg)
	 */
	injectAs: "append-system-prompt" | "message";
	/** Optional positional args after the injection (e.g., task when injectAs is append-system-prompt). */
	trailingArgs?: string[];
	/** Optional debug logger called at key events. */
	onLog?: (msg: string) => void;
}

export interface SpawnPiResult {
	/** The child process. Caller hooks stdout/stderr/close as usual. */
	proc: ChildProcess;
	/** Manually trigger cleanup. Auto-called on proc close/error. */
	cleanup: () => void;
}

export function spawnPiWrapper(opts: SpawnPiOpts): SpawnPiResult {
	const id = genId();
	const safe = safeFilename(opts.agentName);
	const tmp = tmpdir().replace(/\\/g, "/");
	const promptFile = `${tmp}/pi-prompt-${safe}-${id}.txt`;
	const wrapperFile = `${tmp}/pi-run-${safe}-${id}.sh`;

	// Write prompt content (fail loudly — caller must handle)
	try {
		writeFileSync(promptFile, opts.promptContent, "utf-8");
	} catch (e: any) {
		const msg = `spawnPiWrapper: writeFileSync prompt failed: ${e.message}`;
		opts.onLog?.(msg);
		throw new Error(msg);
	}

	// Build wrapper script with proper escaping
	const flagsLine = opts.cliFlags.map(shq).join(" ");
	const promptInjection = `"$(cat ${shq(promptFile)})"`;
	const trailingLine = (opts.trailingArgs || []).map(shq).join(" ");

	let execLine: string;
	if (opts.injectAs === "append-system-prompt") {
		execLine = `exec pi ${flagsLine} --append-system-prompt ${promptInjection} ${trailingLine}`;
	} else {
		// "message" — prompt is the final positional arg
		execLine = `exec pi ${flagsLine} ${trailingLine} ${promptInjection}`;
	}

	const wrapper = `#!/bin/bash\n${execLine}\n`;

	try {
		writeFileSync(wrapperFile, wrapper, { encoding: "utf-8", mode: 0o644 });
	} catch (e: any) {
		try { unlinkSync(promptFile); } catch {}
		const msg = `spawnPiWrapper: writeFileSync wrapper failed: ${e.message}`;
		opts.onLog?.(msg);
		throw new Error(msg);
	}

	const bash = findBash();
	opts.onLog?.(`SPAWN ${safe} id=${id} bash=${bash}`);

	const proc = spawn(bash, [wrapperFile], {
		stdio: ["ignore", "pipe", "pipe"],
		env: { ...process.env },
	});

	let cleaned = false;
	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		try { unlinkSync(promptFile); } catch {}
		try { unlinkSync(wrapperFile); } catch {}
	};

	proc.on("close", cleanup);
	proc.on("error", cleanup);

	return { proc, cleanup };
}
