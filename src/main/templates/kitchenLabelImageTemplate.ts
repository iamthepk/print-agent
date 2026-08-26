import { app, BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  getKitchenLabelDimensions,
  renderKitchenLabelHtml
} from "./kitchenLabelTemplate";

const PNG_SIGNATURE_LENGTH = 8;

export async function generateKitchenLabelPng(
  payload: unknown,
  outputDir: string
): Promise<string> {
  const dimensions = getKitchenLabelDimensions(payload);
  const regularFont = findAssetFont("Atozimple Regular.otf");
  const mediumFont = findAssetFont("Atozimple Medium.otf");
  const html = renderKitchenLabelHtml(payload, {
    regularFontUrl: regularFont ? pathToFileURL(regularFont).toString() : null,
    mediumFontUrl: mediumFont ? pathToFileURL(mediumFont).toString() : null
  });

  await fs.mkdir(outputDir, { recursive: true });

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const htmlPath = path.join(outputDir, `kitchen-label-${id}.html`);
  const pngPath = path.join(outputDir, `kitchen-label-${id}.png`);
  let window: BrowserWindow | null = null;

  try {
    await fs.writeFile(htmlPath, html, "utf8");

    window = new BrowserWindow({
      show: false,
      width: dimensions.widthPx,
      height: dimensions.heightPx,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        offscreen: true,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    await window.loadFile(htmlPath);
    await window.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const done = () => requestAnimationFrame(() => resolve(true));
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(done, done);
        } else {
          done();
        }
      });
    `);

    const image = await window.webContents.capturePage({
      x: 0,
      y: 0,
      width: dimensions.widthPx,
      height: dimensions.heightPx
    });
    const png = withPngDensity(image.toPNG(), dimensions.dpi);
    await fs.writeFile(pngPath, png);
    return pngPath;
  } catch (error) {
    await fs.unlink(pngPath).catch(() => undefined);
    throw error;
  } finally {
    if (window && !window.isDestroyed()) {
      window.close();
    }
    await fs.unlink(htmlPath).catch(() => undefined);
  }
}

function findAssetFont(fileName: string): string | null {
  const candidates = [
    app.isPackaged
      ? path.join(process.resourcesPath, "assets", "fonts", fileName)
      : null,
    path.join(app.getAppPath(), "assets", "fonts", fileName),
    path.join(process.cwd(), "assets", "fonts", fileName)
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      if (require("node:fs").existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function withPngDensity(buffer: Buffer, dpi: number): Buffer {
  const pixelsPerMeter = Math.round(dpi * 39.37007874015748);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(pixelsPerMeter, 0);
  data.writeUInt32BE(pixelsPerMeter, 4);
  data[8] = 1;

  return upsertPngChunk(buffer, "pHYs", data);
}

function upsertPngChunk(buffer: Buffer, type: string, data: Buffer): Buffer {
  if (buffer.length < PNG_SIGNATURE_LENGTH || buffer.toString("ascii", 1, 4) !== "PNG") {
    return buffer;
  }

  const chunk = createPngChunk(type, data);
  const parts: Buffer[] = [buffer.subarray(0, PNG_SIGNATURE_LENGTH)];
  let offset = PNG_SIGNATURE_LENGTH;
  let inserted = false;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const chunkType = buffer.toString("ascii", offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;

    if (chunkEnd > buffer.length) {
      return buffer;
    }

    if (chunkType === type) {
      parts.push(chunk);
      inserted = true;
    } else {
      if (!inserted && chunkType === "IDAT") {
        parts.push(chunk);
        inserted = true;
      }
      parts.push(buffer.subarray(offset, chunkEnd));
    }

    offset = chunkEnd;
  }

  if (!inserted) {
    parts.push(chunk);
  }

  return Buffer.concat(parts);
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
