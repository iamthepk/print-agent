import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Logger } from "../logging/logger";

const execFileAsync = promisify(execFile);

const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const STARTUP_APPROVED_RUN_KEY =
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run";
const RUN_VALUE_NAME = "PrintAgent";
const LEGACY_RUN_VALUE_NAMES = [
  "app.printagent.desktop",
  "electron.app.Print Agent",
  "electron.app.Lootea Print Agent",
  "Print Agent"
];
const STARTUP_ENABLED_BINARY = "020000000000000000000000";

export async function ensureWindowsStartupRegistration(
  startHiddenArg: string,
  logger: Logger
): Promise<void> {
  if (process.platform !== "win32") {
    return;
  }

  const startupCommand = `"${process.execPath}" ${startHiddenArg}`;

  await setRunRegistration(startupCommand, logger);
  await removeRunValues(LEGACY_RUN_VALUE_NAMES);
}

async function setRunRegistration(startupCommand: string, logger: Logger): Promise<void> {
  try {
    await execFileAsync("reg.exe", [
      "ADD",
      RUN_KEY,
      "/v",
      RUN_VALUE_NAME,
      "/t",
      "REG_SZ",
      "/d",
      startupCommand,
      "/f"
    ], {
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });

    await execFileAsync("reg.exe", [
      "ADD",
      STARTUP_APPROVED_RUN_KEY,
      "/v",
      RUN_VALUE_NAME,
      "/t",
      "REG_BINARY",
      "/d",
      STARTUP_ENABLED_BINARY,
      "/f"
    ], {
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });

    logger.info("Windows startup Run registration ensured", {
      valueName: RUN_VALUE_NAME,
      command: startupCommand
    });
  } catch (error) {
    logger.warn("Windows startup Run registration failed", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

async function removeRunValues(valueNames: string[]): Promise<void> {
  for (const valueName of valueNames) {
    await removeRegistryValue(RUN_KEY, valueName);
    await removeRegistryValue(STARTUP_APPROVED_RUN_KEY, valueName);
  }
}

async function removeRegistryValue(
  key: string,
  valueName: string
): Promise<void> {
  try {
    await execFileAsync("reg.exe", [
      "DELETE",
      key,
      "/v",
      valueName,
      "/f"
    ], {
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });
  } catch {
    // Missing legacy values are expected after the first cleanup.
  }
}
