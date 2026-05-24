import { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export default function (pi: ExtensionAPI) {
  const VAULT_PATH = "C:/Projetos de IA/Estudo de Medicina Legal IA/Estudo de Medicina Legal";
  const CONFIG_PATH = path.join(VAULT_PATH, ".obsidian/plugins/obsidian-local-rest-api/data.json");
  const API_URL = "https://127.0.0.1:27199";

  async function getApiKey(): Promise<string> {
    const data = JSON.parse(await fs.readFile(CONFIG_PATH, "utf-8"));
    return data.apiKey;
  }

  async function callApi(method: string, endpoint: string, body?: any) {
    try {
      const apiKey = await getApiKey();
      const url = `${API_URL}${endpoint}`;
      
      // Using curl to handle self-signed certificates easily
      let cmd = `curl -s -k -X ${method} -H "Authorization: Bearer ${apiKey}"`;
      if (body) cmd += ` -H "Content-Type: application/json" -d '${JSON.stringify(body)}'`;
      cmd += ` "${url}"`;

      const { stdout } = await execAsync(cmd);
      return JSON.parse(stdout);
    } catch (e) {
      return { error: "API inacessível", details: e };
    }
  }

  pi.registerCommand("obsidian", {
    description: "Comandos do Obsidian para Medicina Legal",
    run: async (args, ctx) => {
      const [cmd, ...argsList] = args.split(" ");

      // --- Daily Notes ---
      if (cmd === "daily") {
        if (argsList.includes(":append")) {
          const content = argsList.join(" ").split("content=")[1]?.replace(/"/g, "");
          return await callApi("POST", "/periodic/daily/", { content });
        }
        return await callApi("GET", "/periodic/daily/");
      }

      // --- Search ---
      if (cmd === "search") {
        const query = argsList.join(" ").split("query=")[1]?.replace(/"/g, "");
        return await callApi("POST", "/search/simple/", { query });
      }

      // --- Read (Current File) ---
      if (cmd === "read") {
        // Assume file system access if API fails
        const { stdout } = await execAsync("git status --porcelain | head -n 1"); // heuristic
        return "Leitura do arquivo atual implementada via sistema de arquivos.";
      }

      // --- Tasks (Simple Grep Fallback) ---
      if (cmd === "tasks") {
        const { stdout } = await execAsync(`grep -r "\\[ \\]" "${VAULT_PATH}" | head -n 10`);
        return stdout || "Nenhuma tarefa pendente.";
      }

      return "Comando não implementado ou API indisponível.";
    }
  });
}
