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
  getState: (): Promise<AdminState> => ipcRenderer.invoke("admin:get-state"),
  saveConfig: (patch: AgentConfigPatch): Promise<AdminState> => ipcRenderer.invoke("config:save", patch),
  startTunnel: (): Promise<AdminState> => ipcRenderer.invoke("tunnel:start"),
  stopTunnel: (): Promise<AdminState> => ipcRenderer.invoke("tunnel:stop"),
  runTest: (role: PrinterRole): Promise<PrintOperationResult> => ipcRenderer.invoke("test:run", role),
  regenerateToken: (): Promise<string> => ipcRenderer.invoke("token:regenerate"),
  copyRemoteUrl: (): Promise<boolean> => ipcRenderer.invoke("clipboard:copy-url"),
  exportLogs: (): Promise<string | null> => ipcRenderer.invoke("logs:export"),
  restart: (): Promise<boolean> => ipcRenderer.invoke("app:restart"),
  quit: (): Promise<boolean> => ipcRenderer.invoke("app:quit")
});
