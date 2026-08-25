import { contextBridge, ipcRenderer } from "electron";
import type {
  AdminBootstrap,
  AdminState,
  AgentConfigPatch,
  PrintOperationResult,
  PrinterRole
} from "../shared/protocol";

contextBridge.exposeInMainWorld("printAgent", {
  getBootstrap: (): Promise<AdminBootstrap> => ipcRenderer.invoke("app:get-bootstrap"),
  setupPin: (pin: string): Promise<{ authenticated: true; initialApiToken: string | null }> => {
    return ipcRenderer.invoke("auth:setup-pin", pin);
  },
  login: (pin: string): Promise<{ authenticated: true }> => ipcRenderer.invoke("auth:login", pin),
  logout: (): Promise<{ authenticated: false }> => ipcRenderer.invoke("auth:logout"),
  getState: (): Promise<AdminState> => ipcRenderer.invoke("admin:get-state"),
  saveConfig: (patch: AgentConfigPatch): Promise<AdminState> => ipcRenderer.invoke("config:save", patch),
  runTest: (role: PrinterRole): Promise<PrintOperationResult> => ipcRenderer.invoke("test:run", role),
  regenerateToken: (): Promise<string> => ipcRenderer.invoke("token:regenerate"),
  copyRemoteUrl: (): Promise<boolean> => ipcRenderer.invoke("clipboard:copy-url"),
  exportLogs: (): Promise<string | null> => ipcRenderer.invoke("logs:export"),
  restart: (): Promise<boolean> => ipcRenderer.invoke("app:restart"),
  quit: (): Promise<boolean> => ipcRenderer.invoke("app:quit")
});
