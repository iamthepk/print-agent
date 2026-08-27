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
import { NgrokService } from "./tunnel/ngrokService";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

let configService: ConfigService;
let logger: Logger;
let apiServer: HttpApiServer;
let printJobService: PrintJobService;
let ngrokService: NgrokService;

const resolveAssetPath = (fileName: string): string => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", fileName);
  }

  return path.join(app.getAppPath(), "assets", fileName);
};

const resolveIconPath = (): string => resolveAssetPath("icon.ico");

const createTrayIcon = () => {
  const iconPath = resolveIconPath();
  const icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) {
    logger.warn("Tray icon asset could not be loaded", { iconPath });
  }

  return icon;
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
    icon: resolveIconPath(),
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
  const tunnelUrl = ngrokService?.getStatus().publicUrl ?? null;
  clipboard.writeText(tunnelUrl ?? config.remoteAccessUrl ?? configService.getLocalUrl());
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
    tunnel: ngrokService.getStatus(),
    localUrl: configService.getLocalUrl()
  };
};

const registerIpcHandlers = (): void => {
  ipcMain.handle("app:get-bootstrap", () => ({
    agentVersion: AGENT_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    localUrl: configService.getLocalUrl(),
    setupRequired: false,
    authenticated: true,
    initialApiToken: configService.consumeInitialApiToken()
  }));

  ipcMain.handle("admin:get-state", async () => {
    return getAdminState();
  });

  ipcMain.handle("config:save", async (_event, patch: AgentConfigPatch) => {
    await configService.patch(patch);
    await ngrokService.reconcile();
    return getAdminState();
  });

  ipcMain.handle("tunnel:start", async () => {
    await ngrokService.start(true);
    return getAdminState();
  });

  ipcMain.handle("tunnel:stop", async () => {
    await ngrokService.stop();
    return getAdminState();
  });

  ipcMain.handle("test:run", async (_event, role: PrinterRole) => {
    return printJobService.runTest(role);
  });

  ipcMain.handle("token:regenerate", async () => {
    return configService.regenerateApiToken();
  });

  ipcMain.handle("clipboard:copy-url", () => {
    copyRemoteUrl();
    return true;
  });

  ipcMain.handle("logs:export", async () => {
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
    restartApp();
    return true;
  });

  ipcMain.handle("app:quit", () => {
    isQuitting = true;
    app.quit();
    return true;
  });
};

const bootstrap = async (): Promise<void> => {
  nativeTheme.themeSource = "dark";
  app.setAppUserModelId("app.printagent.desktop");

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
  ngrokService = new NgrokService(configService, logger);
  await ngrokService.reconcile();

  registerIpcHandlers();
  createTray();

  if (process.platform === "win32" && app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath
    });
  }

  const showOnCreate = configService.hasInitialApiToken() || !app.isPackaged;
  await createWindow(showOnCreate);
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.on("before-quit", () => {
    isQuitting = true;
    void ngrokService?.stop("Print Agent is quitting.");
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
