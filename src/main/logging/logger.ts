import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { RuntimePaths } from "../runtimePaths";

export class Logger {
  private readonly logFile: string;

  constructor(private readonly paths: RuntimePaths) {
    this.logFile = path.join(paths.logDir, "print-agent.log");
  }

  info(message: string, metadata?: unknown): void {
    this.write("info", message, metadata);
  }

  warn(message: string, metadata?: unknown): void {
    this.write("warn", message, metadata);
  }

  error(message: string, metadata?: unknown): void {
    this.write("error", message, metadata);
  }

  getLogFilePath(): string {
    return this.logFile;
  }

  async exportTo(destinationFile: string): Promise<void> {
    await fsp.mkdir(path.dirname(destinationFile), { recursive: true });
    await fsp.copyFile(this.logFile, destinationFile);
  }

  private write(level: "info" | "warn" | "error", message: string, metadata?: unknown): void {
    const entry = {
      at: new Date().toISOString(),
      level,
      message,
      metadata
    };

    try {
      fs.mkdirSync(this.paths.logDir, { recursive: true });
      fs.appendFileSync(this.logFile, `${JSON.stringify(entry)}\n`, "utf8");
    } catch {
      // Logging must never break sales or printing flows.
    }
  }
}
