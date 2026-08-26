import { app, BrowserWindow, Menu, Tray, clipboard, dialog, ipcMain, nativeImage, nativeTheme } from "electron";
import path from "node:path";
import type { AgentConfigPatch, PrinterRole } from "../shared/protocol";
import { AGENT_VERSION, PROTOCOL_VERSION } from "../shared/protocol";
import { HttpApiServer } from "./api/httpApiServer";
import { ConfigService } from "./config/configService";
import { DedupeStore } from "./dedupe/dedupeStore";
import { Logger } from "./logging/logger";
import { PrintJobService } from "./printJobService";
import { ConfigurablePrinterAdapter } from "./printers/configurablePrinterAdapter";
import { SimulatedPrinterAdapter } from "./printers/simulatedPrinterAdapter";
import { WindowsPrinterAdapter } from "./printers/windowsPrinterAdapter";
import { resolveRuntimePaths } from "./runtimePaths";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let adminAuthenticated = false;

let configService: ConfigService;
let logger: Logger;
let apiServer: HttpApiServer;
let printJobService: PrintJobService;

const createTrayIcon = () => {
  const svg = [
    "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>",
    "<rect width='32' height='32' rx='7' fill='#111827'/>",
    "<path d='M9 12h14a3 3 0 0 1 3 3v6h-4v5H10v-5H6v-6a3 3 0 0 1 3-3Z' fill='#f8fafc'/>",
    "<path d='M11 6h10v6H11V6Zm2 14h6v3h-6v-3Z' fill='#14b8a6'/>",
    "</svg>"
  ].join("");

  return nativeImage.createFromDataURL(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
};

const createWindow = async (showOnCreate: boolean): Promise<void> => {
  if (mainWindow) {
    if (showOnCreate) {
      mainWindow.show();
      mainWindow.focus();
    }
    return;
  }

  mainWindow = new BrowserWindow({
    width: 960,
    height: 620,
    minWidth: 760,
    minHeight: 500,
    show: showOnCreate,
    title: "Print Agent",
    backgroundColor: "#101113",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }
};

const showWindow = (): void => {
  void createWindow(true);
};

const copyRemoteUrl = (): void => {
  const config = configService.getPublicConfig();
  clipboard.writeText(config.remoteAccessUrl ?? configService.getLocalUrl());
};

const restartApp = (): void => {
  isQuitting = true;
  app.relaunch();
  app.exit(0);
};

const createTray = (): void => {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Print Agent");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "Open Print Agent",
      click: showWindow
    },
    {
      label: "Restart",
      click: restartApp
    },
    {
      label: "Copy remote URL",
      click: copyRemoteUrl
    },
    {
      type: "separator"
    },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on("double-click", showWindow);
};

const getAdminState = async () => {
  return {
    config: configService.getPublicConfig(),
    health: await printJobService.getDetailedHealth(),
    printers: await printJobService.getPrinters(),
    localUrl: configService.getLocalUrl()
  };
};

const requireAdmin = (): void => {
  if (!adminAuthenticated) {
    throw new Error("Admin PIN is required.");
  }
};

const registerIpcHandlers = (): void => {
  ipcMain.handle("app:get-bootstrap", () => ({
    agentVersion: AGENT_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    localUrl: configService.getLocalUrl(),
    setupRequired: configService.isSetupRequired(),
    authenticated: adminAuthenticated,
    initialApiToken: null
  }));

  ipcMain.handle("auth:setup-pin", async (_event, pin: string) => {
    if (!configService.isSetupRequired()) {
      throw new Error("Admin PIN is already configured.");
    }
    await configService.setAdminPin(pin);
    adminAuthenticated = true;
    return {
      authenticated: true,
      initialApiToken: configService.consumeInitialApiToken()
    };
  });

  ipcMain.handle("auth:login", async (_event, pin: string) => {
    adminAuthenticated = configService.verifyAdminPin(pin);
    if (!adminAuthenticated) {
      throw new Error("Invalid admin PIN.");
    }
    return {
      authenticated: true
    };
  });

  ipcMain.handle("auth:logout", () => {
    adminAuthenticated = false;
    return {
      authenticated: false
    };
  });

  ipcMain.handle("admin:get-state", async () => {
    requireAdmin();
    return getAdminState();
  });

  ipcMain.handle("config:save", async (_event, patch: AgentConfigPatch) => {
    requireAdmin();
    await configService.patch(patch);
    return getAdminState();
  });

  ipcMain.handle("test:run", async (_event, role: PrinterRole) => {
    requireAdmin();
    return printJobService.runTest(role);
  });

  ipcMain.handle("token:regenerate", async () => {
    requireAdmin();
    return configService.regenerateApiToken();
  });

  ipcMain.handle("clipboard:copy-url", () => {
    requireAdmin();
    copyRemoteUrl();
    return true;
  });

  ipcMain.handle("logs:export", async () => {
    requireAdmin();
    const result = await dialog.showSaveDialog({
      title: "Export Print Agent Log",
      defaultPath: `print-agent-${new Date().toISOString().slice(0, 10)}.log`,
      filters: [{
        name: "Log files",
        extensions: ["log", "txt"]
      }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    await logger.exportTo(result.filePath);
    return result.filePath;
  });

  ipcMain.handle("app:restart", () => {
    requireAdmin();
    restartApp();
    return true;
  });

  ipcMain.handle("app:quit", () => {
    requireAdmin();
    isQuitting = true;
    app.quit();
    return true;
  });
};

const bootstrap = async (): Promise<void> => {
  nativeTheme.themeSource = "dark";

  const paths = resolveRuntimePaths();
  logger = new Logger(paths);

  configService = new ConfigService(paths, logger);
  await configService.init();

  const windowsAdapter = new WindowsPrinterAdapter(paths, logger);
  const simulatedAdapter = new SimulatedPrinterAdapter(
    () => Object.values(configService.getPublicConfig().printerRoles)
      .map((role) => role.printerName)
      .filter((name): name is string => Boolean(name)),
    logger
  );
  const adapter = new ConfigurablePrinterAdapter(configService, windowsAdapter, simulatedAdapter);
  const dedupeStore = new DedupeStore(paths, logger);
  await dedupeStore.init();

  printJobService = new PrintJobService(configService, adapter, dedupeStore, logger);
  apiServer = new HttpApiServer(configService, printJobService, logger);
  await apiServer.start();

  registerIpcHandlers();
  createTray();

  if (process.platform === "win32" && app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath
    });
  }

  const showOnCreate = configService.isSetupRequired() || !app.isPackaged;
  await createWindow(showOnCreate);
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("window-all-closed", () => {
    // Keep the background agent alive after the admin window is closed.
  });

  app.whenReady()
    .then(bootstrap)
    .catch((error) => {
      dialog.showErrorBox(
        "Print Agent",
        error instanceof Error ? error.message : String(error)
      );
      app.quit();
    });
}
