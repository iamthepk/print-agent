import type {
  AdminBootstrap,
  AdminState,
  AgentConfigPatch,
  PrintOperationResult,
  PrinterRole
} from "../shared/protocol";

declare global {
  interface Window {
    printAgent: {
      getBootstrap: () => Promise<AdminBootstrap>;
      getState: () => Promise<AdminState>;
      saveConfig: (patch: AgentConfigPatch) => Promise<AdminState>;
      startTunnel: () => Promise<AdminState>;
      stopTunnel: () => Promise<AdminState>;
      runTest: (role: PrinterRole) => Promise<PrintOperationResult>;
      regenerateToken: () => Promise<string>;
      copyRemoteUrl: () => Promise<boolean>;
      exportLogs: () => Promise<string | null>;
      restart: () => Promise<boolean>;
      quit: () => Promise<boolean>;
    };
  }
}

export {};
