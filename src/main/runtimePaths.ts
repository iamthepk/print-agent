import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export interface RuntimePaths {
  configDir: string;
  configFile: string;
  logDir: string;
  dataDir: string;
}

export const resolveRuntimePaths = (): RuntimePaths => {
  const roamingRoot = process.env.APPDATA ?? app.getPath("appData");
  const localRoot = process.env.LOCALAPPDATA ?? app.getPath("userData");

  const configDir = path.join(roamingRoot, "PrintAgent");
  const logDir = path.join(localRoot, "PrintAgent", "logs");
  const dataDir = path.join(localRoot, "PrintAgent", "runtime");

  return {
    configDir,
    configFile: path.join(configDir, "config.json"),
    logDir,
    dataDir
  };
};

export const ensureRuntimePaths = async (paths: RuntimePaths): Promise<void> => {
  await Promise.all([
    fs.mkdir(paths.configDir, { recursive: true }),
    fs.mkdir(paths.logDir, { recursive: true }),
    fs.mkdir(paths.dataDir, { recursive: true })
  ]);
};
