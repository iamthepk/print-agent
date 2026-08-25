import fs from "node:fs/promises";
import path from "node:path";
import type { PrintJobResponse } from "../../shared/protocol";
import type { Logger } from "../logging/logger";
import type { RuntimePaths } from "../runtimePaths";

interface DedupeRecord {
  jobId: string;
  processedAt: string;
  response: PrintJobResponse;
}

const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;

export class DedupeStore {
  private readonly filePath: string;
  private readonly records = new Map<string, DedupeRecord>();

  constructor(
    paths: RuntimePaths,
    private readonly logger: Logger
  ) {
    this.filePath = path.join(paths.dataDir, "dedupe-history.json");
  }

  async init(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const record of parsed) {
          if (this.isRecord(record)) {
            this.records.set(record.jobId, record);
          }
        }
      }
      await this.cleanup();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.warn("Dedupe history could not be read", {
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  get(jobId: string): PrintJobResponse | null {
    const record = this.records.get(jobId);
    if (!record) {
      return null;
    }

    return {
      ...record.response,
      status: "already_processed"
    };
  }

  async remember(jobId: string, response: PrintJobResponse): Promise<void> {
    this.records.set(jobId, {
      jobId,
      processedAt: new Date().toISOString(),
      response
    });
    await this.cleanup();
    await this.persist();
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [jobId, record] of this.records) {
      if (now - new Date(record.processedAt).getTime() > DEDUPE_TTL_MS) {
        this.records.delete(jobId);
      }
    }
  }

  private async persist(): Promise<void> {
    const records = [...this.records.values()].sort((a, b) => {
      return a.processedAt.localeCompare(b.processedAt);
    });
    await fs.writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }

  private isRecord(value: unknown): value is DedupeRecord {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const record = value as Partial<DedupeRecord>;
    return typeof record.jobId === "string"
      && typeof record.processedAt === "string"
      && typeof record.response === "object"
      && record.response !== null;
  }
}
