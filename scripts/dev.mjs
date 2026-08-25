import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", "5173"], {
  stdio: "inherit",
  shell: true
});

const waitForPort = (port, host, timeoutMs = 30000) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const attempt = () => {
      const socket = net.createConnection({ port, host }, () => {
        socket.end();
        resolve();
      });

      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 300);
      });
    };

    attempt();
  });

const shutdown = (electron) => {
  electron?.kill();
  vite.kill();
};

let electronProcess;

try {
  await waitForPort(5173, "127.0.0.1");
  electronProcess = spawn("npx", ["electron", "."], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: "http://127.0.0.1:5173"
    }
  });

  electronProcess.on("exit", () => shutdown());
} catch (error) {
  console.error(error);
  shutdown();
  process.exitCode = 1;
}

process.on("SIGINT", () => shutdown(electronProcess));
process.on("SIGTERM", () => shutdown(electronProcess));
