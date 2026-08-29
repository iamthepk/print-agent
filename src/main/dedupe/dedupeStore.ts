import fs from "node:fs/promises";
import path from "node:path";
import type { PrintJobResponse } from "../../shared/protocol";
import type { Logger } from "../logging/logger";
import type { RuntimePaths } from "../runtimePaths";

interface DedupeRecord {
  jobId: string;
  requestFingerprint: string | null;
  processedAt: string;
  response: PrintJobResponse;
}

const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;
const LEGACY_FINGERPRINT = "legacy";

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
            const requestFingerprint = record.requestFingerprint ?? LEGACY_FINGERPRINT;
            this.records.set(
              this.recordKey(record.jobId, requestFingerprint),
              {
                ...record,
                requestFingerprint
              }
            );
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

  get(jobId: string, requestFingerprint: string): PrintJobResponse | null {
    const record = this.records.get(this.recordKey(jobId, requestFingerprint));
    if (!record) {
      return null;
    }

    return {
      ...record.response,
      status: "already_processed"
    };
  }

  hasJobId(jobId: string): boolean {
    return [...this.records.values()].some((record) => record.jobId === jobId);
  }

  async remember(
    jobId: string,
    requestFingerprint: string,
    response: PrintJobResponse
  ): Promise<void> {
    this.records.set(this.recordKey(jobId, requestFingerprint), {
      jobId,
      requestFingerprint,
      processedAt: new Date().toISOString(),
      response
    });
    await this.cleanup();
    await this.persist();
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, record] of this.records) {
      if (now - new Date(record.processedAt).getTime() > DEDUPE_TTL_MS) {
        this.records.delete(key);
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
      && (
        typeof record.requestFingerprint === "string"
        || record.requestFingerprint === null
        || record.requestFingerprint === undefined
      )
      && typeof record.processedAt === "string"
      && typeof record.response === "object"
      && record.response !== null;
  }

  private recordKey(jobId: string, requestFingerprint: string): string {
    return `${jobId}\u0000${requestFingerprint}`;
  }
}
