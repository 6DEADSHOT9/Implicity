import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("./", import.meta.url));
const root = fileURLToPath(new URL("../../", import.meta.url));
const vite = fileURLToPath(new URL("./node_modules/vite/bin/vite.js", import.meta.url));
const processes = [
  spawn("uv", [
    "run", "--package", "implicity-engine-demo", "uvicorn",
    "implicity_engine_demo.host:app", "--host", "127.0.0.1", "--port", "5322",
  ], { cwd: root, stdio: "inherit" }),
  spawn(process.execPath, [vite, "--config", "vite.config.ts"], { cwd, stdio: "inherit" }),
];

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill("SIGTERM");
}

for (const child of processes) {
  child.on("error", (error) => { console.error(error.message); stop(); });
  child.on("exit", (code) => {
    if (!stopping && code !== 0) process.exitCode = code ?? 1;
    stop();
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
