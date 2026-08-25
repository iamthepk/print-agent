import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { ApiErrorBody, AgentConfigPatch, AgentHealth, PrintJobRequest } from "../../shared/protocol";
import { AGENT_VERSION, PROTOCOL_VERSION } from "../../shared/protocol";
import type { ConfigService } from "../config/configService";
import type { Logger } from "../logging/logger";
import type { PrintJobService } from "../printJobService";

type RouteHandler = (request: IncomingMessage, response: ServerResponse, url: URL) => Promise<void>;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,x-print-agent-token"
};

export class HttpApiServer {
  private server: http.Server | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly printJobService: PrintJobService,
    private readonly logger: Logger
  ) {}

  async start(): Promise<string> {
    if (this.server) {
      return this.currentUrl();
    }

    this.server = http.createServer((request, response) => {
      void this.dispatch(request, response);
    });

    const { host, port } = this.configService.getPublicConfig().server;

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(port, host, () => {
        this.server?.off("error", reject);
        resolve();
      });
    });

    const url = this.currentUrl();
    this.logger.info("HTTP API started", { url });
    return url;
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    this.server = null;
    this.logger.info("HTTP API stopped");
  }

  currentUrl(): string {
    const address = this.server?.address();
    if (typeof address === "object" && address !== null) {
      return `http://${address.address}:${address.port}`;
    }
    return this.configService.getLocalUrl();
  }

  private async dispatch(request: IncomingMessage, response: ServerResponse): Promise<void> {
    this.applyCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    try {
      const url = new URL(request.url ?? "/", this.configService.getLocalUrl());
      const route = this.resolveRoute(request.method ?? "GET", url.pathname);

      if (!route) {
        this.sendJson(response, 404, {
          error: "not_found",
          message: "Endpoint does not exist."
        });
        return;
      }

      await route(request, response, url);
    } catch (error) {
      this.logger.error("HTTP request failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      this.sendJson(response, 500, {
        error: "internal_error",
        message: "Print Agent hit an unexpected error."
      });
    }
  }

  private resolveRoute(method: string, pathname: string): RouteHandler | null {
    if (method === "GET" && pathname === "/health") {
      return this.handleHealth;
    }

    if (method === "GET" && pathname === "/printers") {
      return this.withToken(async (_request, response) => {
        this.sendJson(response, 200, await this.printJobService.getPrinters());
      });
    }

    if (method === "GET" && pathname === "/config") {
      return this.withToken(async (_request, response) => {
        this.sendJson(response, 200, this.configService.getPublicConfig());
      });
    }

    if (method === "PATCH" && pathname === "/config") {
      return this.withToken(async (request, response) => {
        const body = await this.readJson<AgentConfigPatch>(request);
        this.sendJson(response, 200, await this.configService.patch(body));
      });
    }

    if (method === "POST" && pathname === "/print-jobs") {
      return this.withToken(async (request, response) => {
        const body = await this.readJson<PrintJobRequest>(request);
        const result = await this.printJobService.processJob(body);
        this.sendJson(response, result.status === "invalid_request" ? 400 : 200, result);
      });
    }

    if (method === "POST" && pathname === "/test/receipt") {
      return this.withToken(async (_request, response) => {
        this.sendJson(response, 200, await this.printJobService.runTest("receipt"));
      });
    }

    if (method === "POST" && pathname === "/test/kitchen") {
      return this.withToken(async (_request, response) => {
        this.sendJson(response, 200, await this.printJobService.runTest("kitchen"));
      });
    }

    if (method === "POST" && pathname === "/test/drawer") {
      return this.withToken(async (_request, response) => {
        this.sendJson(response, 200, await this.printJobService.runTest("cash_drawer"));
      });
    }

    return null;
  }

  private handleHealth: RouteHandler = async (request, response) => {
    const token = this.extractToken(request);

    if (!token) {
      const health: AgentHealth = {
        status: "ok",
        agentVersion: AGENT_VERSION,
        protocolVersion: PROTOCOL_VERSION
      };
      this.sendJson(response, 200, health);
      return;
    }

    if (!this.configService.verifyApiToken(token)) {
      this.sendJson(response, 401, {
        error: "bad_token",
        message: "The supplied Print Agent token is invalid."
      });
      return;
    }

    this.sendJson(response, 200, await this.printJobService.getDetailedHealth());
  };

  private withToken(handler: RouteHandler): RouteHandler {
    return async (request, response, url) => {
      if (!this.configService.verifyApiToken(this.extractToken(request))) {
        this.sendJson(response, 401, {
          error: "bad_token",
          message: "A valid Print Agent token is required."
        });
        return;
      }

      await handler(request, response, url);
    };
  }

  private extractToken(request: IncomingMessage): string | undefined {
    const explicit = request.headers["x-print-agent-token"];
    if (typeof explicit === "string" && explicit.trim()) {
      return explicit.trim();
    }

    const auth = request.headers.authorization;
    if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
      return auth.slice("bearer ".length).trim();
    }

    return undefined;
  }

  private async readJson<T>(request: IncomingMessage): Promise<T> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) {
      return {} as T;
    }

    return JSON.parse(raw) as T;
  }

  private sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
    response.writeHead(statusCode, JSON_HEADERS);
    response.end(JSON.stringify(body));
  }

  private applyCorsHeaders(response: ServerResponse): void {
    for (const [header, value] of Object.entries(JSON_HEADERS)) {
      response.setHeader(header, value);
    }
  }
}

export const createApiError = (error: string, message: string): ApiErrorBody => ({
  error,
  message
});
