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
      setupPin: (pin: string) => Promise<{ authenticated: true; initialApiToken: string | null }>;
      login: (pin: string) => Promise<{ authenticated: true }>;
      logout: () => Promise<{ authenticated: false }>;
      getState: () => Promise<AdminState>;
      saveConfig: (patch: AgentConfigPatch) => Promise<AdminState>;
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
