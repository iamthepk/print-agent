import iconv from "iconv-lite";

type UnknownRecord = Record<string, unknown>;

const ESC = 0x1b;
const GS = 0x1d;
const DEFAULT_CODEPAGE = "cp852";
const DEFAULT_MESSAGE = "Smile, You are beautiful!";

export function renderKitchenLabelText(payload: unknown): string {
  const label = normalizeKitchenPayload(payload);

  if (isTestPayload(label)) {
    return [
      "KITCHEN LABEL TEST",
      `Time: ${formatTime(firstString(label, ["createdAt"]) ?? new Date().toISOString())}`,
      "Kitchen printer is connected."
    ].join("\r\n");
  }

  const order = firstString(label, ["order", "orderId"]);
  const round = firstString(label, ["round", "itemId"]);
  const productName = firstString(label, ["name", "productName"]) ?? "Kitchen label";
  const message = firstString(label, ["message", "note"]) ?? DEFAULT_MESSAGE;
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
    .map((value) => `Extra shot: ${value}`);
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
  const genericModifiers = detailLines.length > 0
    ? []
    : asArray(label.modifiers)
      .map((value) => stringifyValue(value))
      .filter((value): value is string => Boolean(value));

  return [
    message,
    [order ? `Order: ${order}` : null, round ? `Drink: ${round}` : null]
      .filter(Boolean)
      .join(", "),
    "",
    productName,
    ...detailLines,
    ...genericModifiers
  ]
    .filter((line): line is string => typeof line === "string" && line.length > 0)
    .join("\r\n");
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

  return omitUndefined({
    ...root,
    ...(nestedLabel ?? {})
  });
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
