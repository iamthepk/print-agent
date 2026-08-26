import iconv from "iconv-lite";

type UnknownRecord = Record<string, unknown>;

const ESC = 0x1b;
const GS = 0x1d;
const DEFAULT_CODEPAGE = "cp852";

interface KitchenTemplateConfig {
  labels: {
    order: string;
    drink: string;
    extraShot: string;
  };
  layout: {
    widthPx: number;
    heightPx: number;
    dpi: number;
    paddingYMm: number;
    paddingXMm: number;
    topRowGapMm: number;
    bodyFontSizeMm: number;
    lineFontSizeMm: number;
    nameFontSizeMm: number;
    noteFontSizeMm: number;
    lineMarginBottomMm: number;
    noteMarginBottomMm: number;
    fontFamily: string;
    messageWidthChars: number;
  };
  defaultMessage: string | null;
}

interface KitchenLabelHtmlOptions {
  regularFontUrl?: string | null;
  mediumFontUrl?: string | null;
}

const DEFAULT_KITCHEN_TEMPLATE: KitchenTemplateConfig = {
  labels: {
    order: "Order",
    drink: "Drink",
    extraShot: "Extra shot"
  },
  layout: {
    widthPx: 732,
    heightPx: 342,
    dpi: 300,
    paddingYMm: 2,
    paddingXMm: 3,
    topRowGapMm: 60,
    bodyFontSizeMm: 5,
    lineFontSizeMm: 6,
    nameFontSizeMm: 6.5,
    noteFontSizeMm: 6,
    lineMarginBottomMm: 1.5,
    noteMarginBottomMm: 1.2,
    fontFamily: "Atozimple",
    messageWidthChars: 25
  },
  defaultMessage: null
};

export function renderKitchenLabelText(payload: unknown): string {
  const data = buildKitchenLabelData(payload);
  const label = data.label;

  if (isTestPayload(label)) {
    return [
      "KITCHEN LABEL TEST",
      `Time: ${formatTime(firstString(label, ["createdAt"]) ?? new Date().toISOString())}`,
      "Kitchen printer is connected."
    ].join("\r\n");
  }

  const genericModifiers = data.detailLines.length > 0
    ? []
    : asArray(label.modifiers)
      .map((value) => stringifyValue(value))
      .filter((value): value is string => Boolean(value));

  return [
    data.message,
    data.orderInfo,
    "",
    data.productName,
    ...data.detailLines,
    ...genericModifiers
  ]
    .filter((line): line is string => typeof line === "string" && line.length > 0)
    .join("\r\n");
}

export function renderKitchenLabelHtml(
  payload: unknown,
  options: KitchenLabelHtmlOptions = {}
): string {
  const data = buildKitchenLabelData(payload);
  const { layout } = data.template;
  const fontFamily = cssString(layout.fontFamily);
  const fontFaces = [
    options.regularFontUrl
      ? `@font-face { font-family: ${fontFamily}; src: url(${cssUrl(options.regularFontUrl)}) format("opentype"); font-weight: normal; font-style: normal; }`
      : "",
    options.mediumFontUrl
      ? `@font-face { font-family: ${fontFamily}; src: url(${cssUrl(options.mediumFontUrl)}) format("opentype"); font-weight: 500; font-style: normal; }`
      : ""
  ].filter(Boolean).join("\n");

  const detailHtml = [
    data.flavor ? `<div class="drink-note">${escapeHtml(data.flavor)}</div>` : "",
    `<div class="drink-note">${escapeHtml(data.drinkNote)}</div>`,
    data.milkAlcoholNote ? `<div class="drink-note">${escapeHtml(data.milkAlcoholNote)}</div>` : "",
    ...data.extraShots.map((line) => `<div class="topping">${escapeHtml(line)}</div>`),
    ...data.toppings.map((line) => `<div class="topping">${escapeHtml(line)}</div>`)
  ].filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html style="width: ${layout.widthPx}px; height: ${layout.heightPx}px">
  <head>
    <meta charset="utf-8" />
    <style>
      ${fontFaces}

      html,
      body {
        width: ${layout.widthPx}px;
        height: ${layout.heightPx}px;
        margin: 0;
        padding: 0;
        font-family: ${fontFamily}, Arial, sans-serif;
        font-size: ${layout.bodyFontSizeMm}mm;
        box-sizing: border-box;
        background-color: white;
        color: black;
      }

      .wrapper {
        width: 100%;
        height: 100%;
        padding: ${layout.paddingYMm}mm ${layout.paddingXMm}mm;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        background-color: white;
        box-sizing: border-box;
        overflow: hidden;
      }

      .top-row {
        display: flex;
        justify-content: flex-start;
        gap: ${layout.topRowGapMm}mm;
        width: 100%;
        margin-bottom: 1mm;
        white-space: nowrap;
      }

      .message,
      .order-info,
      .drink-name,
      .drink-note,
      .topping {
        font-family: ${fontFamily}, Arial, sans-serif;
        font-weight: normal;
      }

      .message {
        white-space: pre;
      }

      .line {
        margin-bottom: ${layout.lineMarginBottomMm}mm;
        white-space: pre-wrap;
        word-break: break-word;
        width: 100%;
        font-size: ${layout.lineFontSizeMm}mm;
      }

      .drink-name {
        font-size: ${layout.nameFontSizeMm}mm;
      }

      .drink-note {
        font-size: ${layout.noteFontSizeMm}mm;
        margin-bottom: ${layout.noteMarginBottomMm}mm;
        font-style: italic;
      }

      .topping {
        font-size: ${layout.noteFontSizeMm}mm;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="top-row">
        <div class="message">${escapeHtml(data.message ?? "")}</div>
        <div class="order-info">${escapeHtml(data.orderInfo)}</div>
      </div>

      <div class="line"><span class="drink-name">${escapeHtml(data.productName)}</span></div>

      ${detailHtml}
    </div>
  </body>
</html>`;
}

export function getKitchenLabelDimensions(payload: unknown): {
  widthPx: number;
  heightPx: number;
  dpi: number;
} {
  const { layout } = resolveKitchenTemplate(normalizeKitchenPayload(payload));
  return {
    widthPx: layout.widthPx,
    heightPx: layout.heightPx,
    dpi: layout.dpi
  };
}

export function renderKitchenLabelEscPos(payload: unknown, codepage = DEFAULT_CODEPAGE): Buffer {
  const text = renderKitchenLabelText(payload).replace(/\r\n/g, "\n");
  const encoded = iconv.encode(text, codepage);
  return Buffer.concat([
    Buffer.from([ESC, 0x40]),
    setCodepage(codepage),
    Buffer.from([ESC, 0x45, 0x01]),
    encoded,
    Buffer.from([ESC, 0x45, 0x00]),
    Buffer.from([0x0a, 0x0a, 0x0a, GS, 0x56, 0x01])
  ]);
}

function normalizeKitchenPayload(payload: unknown): UnknownRecord {
  const root = asRecord(payload) ?? {};
  const nestedLabel = asRecord(root.label);

  if (nestedLabel) {
    return omitUndefined({
      ...nestedLabel,
      template: nestedLabel.template ?? root.template ?? root.kitchenTemplate ?? root.printTemplate
    });
  }

  return omitUndefined(root);
}

function buildKitchenLabelData(payload: unknown) {
  const label = normalizeKitchenPayload(payload);
  const template = resolveKitchenTemplate(label);
  const order = firstString(label, ["order", "orderId"]);
  const round = firstString(label, ["round", "itemId"]);
  const productName = firstString(label, ["name", "productName"]) ?? "Kitchen label";
  const message =
    firstString(label, ["message", "note"]) ??
    (template.defaultMessage && template.defaultMessage.trim()
      ? template.defaultMessage
      : null);
  const displayMessage = formatKitchenMessage(message, template.layout.messageWidthChars);
  const flavor = firstString(label, ["flavor"]);
  const drinkNote = [
    firstString(label, ["sweetness"]),
    firstString(label, ["ice"])
  ].filter(Boolean).join(" ; ");
  const milkAlcoholNote = [
    firstString(label, ["milk"]),
    firstString(label, ["alcohol"])
  ].filter(Boolean).join(" | ");
  const extraShots = asArray(label.extraShots)
    .map((value) => stringifyValue(value))
    .filter((value): value is string => Boolean(value))
    .map((value) => `${template.labels.extraShot}: ${value}`);
  const toppings = asArray(label.toppings)
    .map((value) => stringifyValue(value))
    .filter((value): value is string => Boolean(value));
  const detailLines = [
    flavor,
    drinkNote,
    milkAlcoholNote,
    ...extraShots,
    ...toppings
  ].filter((line): line is string => typeof line === "string" && line.length > 0);
  const orderInfo = [
    order ? `${template.labels.order}: ${order}` : null,
    round ? `${template.labels.drink}: ${round}` : null
  ].filter(Boolean).join(", ");

  return {
    label,
    template,
    orderInfo,
    productName,
    message: displayMessage,
    flavor,
    drinkNote,
    milkAlcoholNote,
    extraShots,
    toppings,
    detailLines
  };
}

function resolveKitchenTemplate(label: UnknownRecord): KitchenTemplateConfig {
  const configured =
    asRecord(label.template) ??
    asRecord(label.kitchenTemplate) ??
    asRecord(label.printTemplate) ??
    {};
  const labels = asRecord(configured.labels) ?? {};
  const layout = asRecord(configured.layout) ?? {};

  return {
    labels: {
      order: firstString(labels, ["order"]) ?? DEFAULT_KITCHEN_TEMPLATE.labels.order,
      drink: firstString(labels, ["drink"]) ?? DEFAULT_KITCHEN_TEMPLATE.labels.drink,
      extraShot:
        firstString(labels, ["extraShot", "extra_shot"]) ??
        DEFAULT_KITCHEN_TEMPLATE.labels.extraShot
    },
    layout: {
      widthPx: numberInRange(layout.widthPx, DEFAULT_KITCHEN_TEMPLATE.layout.widthPx, 100, 2000),
      heightPx: numberInRange(layout.heightPx, DEFAULT_KITCHEN_TEMPLATE.layout.heightPx, 100, 2000),
      dpi: numberInRange(layout.dpi, DEFAULT_KITCHEN_TEMPLATE.layout.dpi, 72, 1200),
      paddingYMm: numberInRange(layout.paddingYMm, DEFAULT_KITCHEN_TEMPLATE.layout.paddingYMm, 0, 20),
      paddingXMm: numberInRange(layout.paddingXMm, DEFAULT_KITCHEN_TEMPLATE.layout.paddingXMm, 0, 20),
      topRowGapMm: numberInRange(layout.topRowGapMm, DEFAULT_KITCHEN_TEMPLATE.layout.topRowGapMm, 0, 200),
      bodyFontSizeMm: numberInRange(layout.bodyFontSizeMm, DEFAULT_KITCHEN_TEMPLATE.layout.bodyFontSizeMm, 1, 20),
      lineFontSizeMm: numberInRange(layout.lineFontSizeMm, DEFAULT_KITCHEN_TEMPLATE.layout.lineFontSizeMm, 1, 20),
      nameFontSizeMm: numberInRange(layout.nameFontSizeMm, DEFAULT_KITCHEN_TEMPLATE.layout.nameFontSizeMm, 1, 24),
      noteFontSizeMm: numberInRange(layout.noteFontSizeMm, DEFAULT_KITCHEN_TEMPLATE.layout.noteFontSizeMm, 1, 20),
      lineMarginBottomMm: numberInRange(layout.lineMarginBottomMm, DEFAULT_KITCHEN_TEMPLATE.layout.lineMarginBottomMm, 0, 20),
      noteMarginBottomMm: numberInRange(layout.noteMarginBottomMm, DEFAULT_KITCHEN_TEMPLATE.layout.noteMarginBottomMm, 0, 20),
      fontFamily: firstString(layout, ["fontFamily", "font_family"]) ?? DEFAULT_KITCHEN_TEMPLATE.layout.fontFamily,
      messageWidthChars: Math.round(
        numberInRange(
          layout.messageWidthChars ?? layout.message_width_chars,
          DEFAULT_KITCHEN_TEMPLATE.layout.messageWidthChars,
          0,
          80
        )
      )
    },
    defaultMessage:
      firstString(configured, ["defaultMessage", "default_message"]) ??
      DEFAULT_KITCHEN_TEMPLATE.defaultMessage
  };
}

function formatKitchenMessage(message: string | null, widthChars: number): string | null {
  if (!message) {
    return null;
  }

  const normalized = message.slice(0, widthChars);
  return widthChars > 0 ? normalized.padEnd(widthChars, " ") : normalized;
}

function setCodepage(codepage: string): Buffer {
  const codepageMap: Record<string, number> = {
    cp437: 0,
    cp850: 2,
    cp852: 18,
    cp858: 19,
    cp866: 17,
    cp1250: 35,
    cp1252: 16
  };

  return Buffer.from([ESC, 0x74, codepageMap[codepage.toLowerCase()] ?? 18]);
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("cs-CZ", { hour12: false });
}

function firstString(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const text = stringifyValue(record[key]);
    if (text) {
      return text;
    }
  }

  return null;
}

function numberInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue)
    ? Math.max(min, Math.min(max, numberValue))
    : fallback;
}

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const record = asRecord(value);
  if (record) {
    return firstString(record, ["name", "label", "title"]);
  }

  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cssString(value: string): string {
  return JSON.stringify(value);
}

function cssUrl(value: string): string {
  return JSON.stringify(value);
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isTestPayload(record: UnknownRecord): boolean {
  return firstString(record, ["kind"]) === "test" || record.test === true;
}

function omitUndefined(record: UnknownRecord): UnknownRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  );
}
