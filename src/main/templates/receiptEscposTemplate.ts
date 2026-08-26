import iconv from "iconv-lite";

type UnknownRecord = Record<string, unknown>;
type ReceiptLineAlign = "left" | "center" | "right";
type ReceiptLineEmphasis = "normal" | "bold" | "title" | "total";

interface ReceiptLine {
  text: string;
  align?: ReceiptLineAlign;
  emphasis?: ReceiptLineEmphasis;
}

interface RenderReceiptOptions {
  charsPerLine?: number;
  codepage?: string;
  font?: number | string;
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const DEFAULT_CHARS_PER_LINE = 48;
const DEFAULT_CODEPAGE = "cp852";

const CMD = {
  INIT: Buffer.from([ESC, 0x40]),
  ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),
  NORMAL_SIZE: Buffer.from([ESC, 0x21, 0x00]),
  DOUBLE_HEIGHT: Buffer.from([ESC, 0x21, 0x10]),
  DOUBLE_BOTH: Buffer.from([ESC, 0x21, 0x30]),
  FEED_LINE: Buffer.from([LF]),
  CUT_PAPER_PARTIAL: Buffer.from([GS, 0x56, 0x01])
};

const FONT = {
  A: 0,
  B: 1,
  C: 48,
  D: 2,
  E: 3,
  SPECIAL_A: 97,
  SPECIAL_B: 98
} as const;

const FONT_NAME_TO_NUMBER: Record<string, number> = {
  A: FONT.A,
  B: FONT.B,
  C: FONT.C,
  D: FONT.D,
  E: FONT.E,
  SPECIAL_A: FONT.SPECIAL_A,
  SPECIAL_B: FONT.SPECIAL_B,
  "0": FONT.A,
  "1": FONT.B,
  "2": FONT.D,
  "3": FONT.E,
  "48": FONT.C,
  "49": FONT.B,
  "50": FONT.C,
  "51": FONT.D,
  "52": FONT.E,
  "97": FONT.SPECIAL_A,
  "98": FONT.SPECIAL_B
};

export function renderReceiptEscPos(
  payload: unknown,
  options: RenderReceiptOptions = {}
): Buffer {
  const charsPerLine = options.charsPerLine ?? DEFAULT_CHARS_PER_LINE;
  const codepage = options.codepage ?? DEFAULT_CODEPAGE;
  const lines = buildReceiptLines(payload, charsPerLine);
  const encode = (text: string) => iconv.encode(text, codepage);
  const buffers: Buffer[] = [
    CMD.INIT,
    setCodepage(codepage),
    setFont(options.font ?? FONT.A),
    CMD.ALIGN_LEFT
  ];

  for (const line of lines) {
    buffers.push(...renderEscPosLine(line, encode));
  }

  buffers.push(
    CMD.NORMAL_SIZE,
    CMD.BOLD_OFF,
    CMD.ALIGN_LEFT,
    CMD.FEED_LINE,
    CMD.FEED_LINE,
    CMD.FEED_LINE,
    CMD.CUT_PAPER_PARTIAL
  );

  return Buffer.concat(buffers);
}

export function renderReceiptText(
  payload: unknown,
  options: RenderReceiptOptions = {}
): string {
  const charsPerLine = options.charsPerLine ?? DEFAULT_CHARS_PER_LINE;
  return buildReceiptLines(payload, charsPerLine)
    .map((line) => formatPlainLine(line, charsPerLine))
    .join("\r\n")
    .concat("\r\n");
}

function renderEscPosLine(
  line: ReceiptLine,
  encode: (text: string) => Buffer
): Buffer[] {
  const buffers: Buffer[] = [];
  const align = line.align ?? "left";

  if (align === "center") {
    buffers.push(CMD.ALIGN_CENTER);
  } else if (align === "right") {
    buffers.push(CMD.ALIGN_RIGHT);
  } else {
    buffers.push(CMD.ALIGN_LEFT);
  }

  const emphasis = line.emphasis ?? "normal";
  if (emphasis === "title") {
    buffers.push(CMD.BOLD_ON, CMD.DOUBLE_BOTH);
  } else if (emphasis === "total") {
    buffers.push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
  } else if (emphasis === "bold") {
    buffers.push(CMD.BOLD_ON);
  }

  if (line.text) {
    buffers.push(encode(line.text));
  }
  buffers.push(CMD.FEED_LINE);

  if (emphasis !== "normal") {
    buffers.push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
  }

  return buffers;
}

function buildReceiptLines(payload: unknown, charsPerLine: number): ReceiptLine[] {
  const receipt = normalizeReceiptPayload(payload);

  if (isTestPayload(receipt)) {
    return buildTestReceiptLines(receipt, charsPerLine);
  }

  const lines: ReceiptLine[] = [];
  const orderNumber = firstString(receipt, ["orderNumber", "order_number", "orderId"]);
  const receiptNumber =
    firstString(receipt, ["receiptNumber", "receipt_number"]) ?? orderNumber;
  const companyName = firstString(receipt, ["company_name", "headerText", "companyName"]);

  if (orderNumber) {
    lines.push({ text: `#${orderNumber}`, align: "right", emphasis: "bold" });
  }

  if (companyName) {
    lines.push({ text: companyName, align: "center", emphasis: "title" });
    lines.push({ text: "" });
  }

  appendOptionalCentered(lines, firstString(receipt, ["company_VAT", "companyVat", "dic", "ico"]));
  appendOptionalCentered(lines, firstString(receipt, ["company_address", "companyAddress"]));

  const cityLine = [
    firstString(receipt, ["company_city", "companyCity"]),
    firstString(receipt, ["company_poscode", "companyPostalCode", "company_postal_code"])
  ].filter(Boolean).join(" ");
  appendOptionalCentered(lines, cityLine);
  appendOptionalCentered(lines, firstString(receipt, ["company_country", "companyCountry"]));
  appendOptionalCentered(lines, firstString(receipt, ["company_phone", "companyPhone"]));
  appendOptionalCentered(lines, firstString(receipt, ["company_email", "companyEmail"]));
  appendOptionalCentered(lines, firstString(receipt, ["company_website", "companyWebsite"]));

  lines.push({ text: "" });

  const totalCZK = firstNumber(receipt, [
    "totalCZK",
    "total_czk",
    "total",
    "totalAmount",
    "total_amount",
    "grandTotal",
    "grand_total"
  ]);
  const isRefund =
    receipt.isRefund === true ||
    firstString(receipt, ["kind"]) === "refund_receipt" ||
    (typeof totalCZK === "number" && totalCZK < 0);

  if (isRefund) {
    lines.push({ text: "REFUND RECEIPT", align: "center", emphasis: "total" });
    lines.push({ text: "" });
  }

  if (receiptNumber) {
    lines.push({ text: `Receipt No.: ${receiptNumber}` });
  }

  const originalReceiptNumber = firstString(receipt, [
    "originalReceiptNumber",
    "original_receipt_number"
  ]);
  if (originalReceiptNumber) {
    lines.push({ text: `Refunded Receipt No.: ${originalReceiptNumber}` });
  }

  const customerName = firstString(receipt, ["customerName", "customer_name"]);
  if (customerName && customerName !== "Walk-in Customer") {
    lines.push({ text: `Customer: ${customerName}` });
  }

  const createdAt = firstString(receipt, ["displayCreatedAt", "createdAt", "created_at"]);
  if (createdAt) {
    lines.push({ text: `Date: ${formatDate(createdAt)}` });
  }

  lines.push({ text: "" }, { text: separator(charsPerLine) });

  const items = asArray(receipt.items);
  let itemCount = 0;

  for (const [index, itemValue] of items.entries()) {
    const item = asRecord(itemValue) ?? {};
    const quantity = firstNumber(item, ["quantity", "qty"]) ?? 1;
    const unitPrice = firstNumber(item, ["unitPrice", "unit_price", "price"]) ?? 0;
    const lineTotal =
      firstNumber(item, ["lineTotal", "totalPrice", "total"]) ?? quantity * unitPrice;
    const displayUnitPrice = isRefund ? -Math.abs(unitPrice) : unitPrice;
    const displayLineTotal = isRefund ? -Math.abs(lineTotal) : lineTotal;
    const name = firstString(item, ["name", "productName", "title"]) ?? "Item";
    const displayLines = buildItemDisplayLines(item, name);
    const itemReceiptLines: ReceiptLine[] = [];

    itemCount += quantity;

    displayLines.forEach((displayLine, lineIndex) => {
      for (const wrapped of wrapText(displayLine, charsPerLine)) {
        itemReceiptLines.push({
          text: wrapped,
          emphasis: lineIndex === 0 ? "bold" : "normal"
        });
      }
    });

    if (quantity > 1) {
      itemReceiptLines.push({
        text: padLine(`${formatQuantity(quantity)} x ${formatMoney(displayUnitPrice)}`, "", charsPerLine)
      });
    }

    appendAmountToItemLines(itemReceiptLines, formatMoney(displayLineTotal), charsPerLine);
    lines.push(...itemReceiptLines);

    if (index < items.length - 1) {
      lines.push({ text: dottedSeparator(charsPerLine) });
    }
  }

  lines.push({ text: "" }, { text: separator(charsPerLine) });
  lines.push({ text: `Items Count: ${formatQuantity(itemCount)}` });
  lines.push({ text: "" }, { text: separator(charsPerLine) });

  const subtotal = firstNumber(receipt, ["subtotal"]);
  if (
    typeof subtotal === "number" &&
    typeof totalCZK === "number" &&
    Math.abs(subtotal - totalCZK) > 0.005
  ) {
    const displaySubtotal = isRefund ? -Math.abs(subtotal) : subtotal;
    lines.push({ text: padLine("Subtotal:", formatMoney(displaySubtotal), charsPerLine) });
  }

  const vatItems = asArray(receipt.vat);
  for (const vatItemValue of vatItems.length > 0 ? vatItems : asArray(receipt.taxes)) {
    const vatItem = asRecord(vatItemValue);
    if (!vatItem) continue;

    const rate = firstNumber(vatItem, ["rate"]);
    const amount = firstNumber(vatItem, ["amount"]);
    if (typeof rate !== "number" || typeof amount !== "number") continue;

    const displayVatAmount = isRefund ? -Math.abs(amount) : amount;
    lines.push({
      text: padLine(`Tax ${formatQuantity(rate)}%:`, formatMoney(displayVatAmount), charsPerLine)
    });
  }

  const discountAmount = firstNumber(receipt, ["discountAmount", "discount_amount"]);
  if (typeof discountAmount === "number" && discountAmount > 0) {
    let discountLabel = "Discount";
    const discountPercent = firstNumber(receipt, ["discountPercent", "discount_percent"]);
    const discountName = firstString(receipt, ["discountName", "discount_name"]);

    if (typeof discountPercent === "number" && discountPercent > 0) {
      discountLabel = `Discount ${formatQuantity(discountPercent)}%`;
    } else if (discountName) {
      discountLabel = `Discount (${discountName})`;
    }

    lines.push({
      text: padLine(`${discountLabel}:`, `-${formatMoney(discountAmount)}`, charsPerLine)
    });
    lines.push({ text: `You saved ${formatMoney(discountAmount)}!`, align: "center" });
  }

  const rounding = firstNumber(receipt, ["rounding", "cashRounding", "roundingCZK"]) ?? 0;
  const displayTotal = isRefund ? -Math.abs(totalCZK ?? 0) : totalCZK ?? 0;
  const displayRounding = isRefund ? -Math.abs(rounding) : rounding;
  const payable = displayTotal + displayRounding;

  if (rounding !== 0) {
    lines.push({
      text: padLine("ROUNDING:", formatMoney(displayRounding), charsPerLine)
    });
  }

  lines.push({ text: "" }, { text: separator(charsPerLine) });
  lines.push({
    text: padLine("TOTAL:", formatMoney(payable, true), charsPerLine),
    emphasis: "total"
  });

  const totalEUR = firstNumber(receipt, ["totalEUR", "total_eur"]);
  if (typeof totalEUR === "number") {
    const displayTotalEUR = isRefund ? -Math.abs(totalEUR) : totalEUR;
    lines.push({ text: `= ${formatMoney(displayTotalEUR, false, "EUR")}`, align: "right" });
  }

  lines.push({ text: separator(charsPerLine) }, { text: "" });
  appendPaymentLines(lines, receipt, displayTotal, isRefund, charsPerLine);

  const exchangeRate = firstString(receipt, ["exchangeRate", "exchange_rate"]);
  if (exchangeRate) {
    lines.push({ text: "" });
    lines.push({ text: `Exchange rate: ${exchangeRate}`, align: "center" });
  }

  appendFooter(lines, receipt);
  return lines;
}

function buildTestReceiptLines(receipt: UnknownRecord, charsPerLine: number): ReceiptLine[] {
  return [
    { text: "PRINT AGENT TEST", align: "center", emphasis: "title" },
    { text: "" },
    { text: `Date: ${formatDate(firstString(receipt, ["createdAt"]) ?? new Date().toISOString())}` },
    { text: "" },
    { text: separator(charsPerLine) },
    { text: "Receipt printer is connected." },
    { text: "This is a test receipt from Print Agent." },
    { text: separator(charsPerLine) }
  ];
}

function normalizeReceiptPayload(payload: unknown): UnknownRecord {
  const root = asRecord(payload) ?? {};
  const flattened = flattenProtocolPayload(root);
  const nestedReceipt = asRecord(root.receipt);

  if (!nestedReceipt) {
    return flattened;
  }

  return omitUndefined({
    ...flattened,
    ...nestedReceipt
  });
}

function flattenProtocolPayload(root: UnknownRecord): UnknownRecord {
  return omitUndefined({
    ...root,
    ...(asRecord(root.company) ?? {}),
    ...(asRecord(root.totals) ?? {}),
    ...(asRecord(root.refund) ?? {})
  });
}

function appendPaymentLines(
  lines: ReceiptLine[],
  receipt: UnknownRecord,
  displayTotal: number,
  isRefund: boolean,
  charsPerLine: number
): void {
  const total = isRefund ? -Math.abs(displayTotal) : displayTotal;

  if (isRefund) {
    const method = firstString(receipt, ["paymentMethod", "payment_method"]) ?? "Card";
    lines.push({ text: padLine(`${method}:`, formatMoney(total), charsPerLine), emphasis: "bold" });
    lines.push({
      text: padLine("Refunded amount:", formatMoney(total), charsPerLine),
      emphasis: "bold"
    });
    return;
  }

  const payments = asArray(receipt.payments)
    .map((paymentValue) => asRecord(paymentValue))
    .filter((payment): payment is UnknownRecord => payment !== null);

  if (payments.length > 0) {
    for (const payment of payments) {
      const method = firstString(payment, ["method", "methodName", "name"]) ?? "Payment";
      const amount = firstNumber(payment, ["amount"]) ?? total;
      lines.push({
        text: padLine(`${method}:`, formatMoney(amount), charsPerLine),
        emphasis: "bold"
      });
    }
    lines.push({
      text: padLine("PAID AMOUNT:", formatMoney(total), charsPerLine),
      emphasis: "bold"
    });
    return;
  }

  const paymentMethod = firstString(receipt, ["paymentMethod", "payment_method"]) ?? "Card";
  const splitPayment = parseSplitPayment(paymentMethod);

  if (splitPayment.length > 0) {
    for (const payment of splitPayment) {
      lines.push({
        text: padLine(`${payment.methodName}:`, formatMoney(payment.amount), charsPerLine),
        emphasis: "bold"
      });
    }
    lines.push({
      text: padLine("PAID AMOUNT:", formatMoney(total), charsPerLine),
      emphasis: "bold"
    });
    return;
  }

  const method =
    paymentMethod === "Card" || paymentMethod === "Card - Contactless"
      ? "Card - Contactless"
      : paymentMethod;
  lines.push({ text: padLine(`${method}:`, formatMoney(total), charsPerLine), emphasis: "bold" });

  const givenAmount = firstNumber(receipt, ["givenAmount", "given_amount"]);
  const change = firstNumber(receipt, ["change"]);
  if (typeof givenAmount === "number" && givenAmount > 0) {
    lines.push({
      text: padLine("Given amount:", formatMoney(givenAmount), charsPerLine),
      emphasis: "bold"
    });
    if (typeof change === "number" && change > 0) {
      lines.push({
        text: padLine("Change:", formatMoney(change), charsPerLine),
        emphasis: "bold"
      });
    }
  } else {
    lines.push({
      text: padLine("Paid amount:", formatMoney(total), charsPerLine),
      emphasis: "bold"
    });
  }
}

function appendFooter(lines: ReceiptLine[], receipt: UnknownRecord): void {
  const footerCustomText = firstString(receipt, ["footer_custom_text", "footerCustomText"]);
  const footerSocialText = firstString(receipt, ["footer_social_text", "footerSocialText"]);
  const footerSocialHandle = firstString(receipt, ["footer_social_handle", "footerSocialHandle"]);

  if (footerCustomText || footerSocialText || footerSocialHandle) {
    lines.push({ text: "" });
  }

  if (footerCustomText) {
    lines.push({ text: footerCustomText, align: "center", emphasis: "total" });
  }
  if (footerSocialText) {
    lines.push({ text: footerSocialText, align: "center" });
  }
  if (footerSocialHandle) {
    lines.push({ text: footerSocialHandle, align: "center" });
  }
}

function appendOptionalCentered(lines: ReceiptLine[], value: string | null | undefined): void {
  if (value) {
    lines.push({ text: value, align: "center" });
  }
}

function buildItemDisplayLines(item: UnknownRecord, fallbackName: string): string[] {
  const lines = splitReceiptTextLines(fallbackName);

  for (const modifier of extractItemModifiers(item)) {
    appendUniqueLine(lines, modifier);
  }

  return lines.length > 0 ? lines : ["Item"];
}

function splitReceiptTextLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => normalizeReceiptTextLine(line))
    .filter((line): line is string => Boolean(line));
}

function normalizeReceiptTextLine(value: string | null): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function appendUniqueLine(lines: string[], value: string): void {
  const normalized = normalizeReceiptTextLine(value);
  if (!normalized) {
    return;
  }

  const normalizedKey = normalized.toLowerCase();
  const exists = lines.some((line) => line.toLowerCase() === normalizedKey);
  if (!exists) {
    lines.push(normalized);
  }
}

function appendAmountToItemLines(
  lines: ReceiptLine[],
  amount: string,
  charsPerLine: number
): void {
  if (lines.length === 0) {
    lines.push({ text: padLine("", amount, charsPerLine) });
    return;
  }

  const lastLine = lines[lines.length - 1];
  if (lastLine.text.length + amount.length + 1 <= charsPerLine) {
    lastLine.text = padLine(lastLine.text, amount, charsPerLine);
    return;
  }

  lines.push({ text: padLine("", amount, charsPerLine) });
}

function extractItemModifiers(item: UnknownRecord): string[] {
  const modifiers: string[] = [];
  const arrayFields = ["options", "modifiers", "choices", "toppings", "extraShots"];

  for (const field of arrayFields) {
    for (const value of asArray(item[field])) {
      const record = asRecord(value);
      const text = record
        ? firstString(record, ["name", "label", "title"])
        : stringifyValue(value);
      if (text) {
        modifiers.push(field === "extraShots" ? `Extra shot: ${text}` : text);
      }
    }
  }

  for (const field of ["flavor", "sweetness", "ice", "milk", "alcohol"]) {
    const text = firstString(item, [field]);
    if (text) {
      modifiers.push(text);
    }
  }

  return modifiers;
}

function setFont(font: number | string): Buffer {
  if (typeof font === "number") {
    return Buffer.from([ESC, 0x4d, font]);
  }

  const normalized = font.toUpperCase();
  const resolved = FONT_NAME_TO_NUMBER[normalized] ?? Number.parseInt(font, 10);
  return Buffer.from([ESC, 0x4d, Number.isFinite(resolved) ? resolved : FONT.A]);
}

function setCodepage(codepage: string): Buffer {
  const codepageMap: Record<string, number> = {
    cp437: 0,
    cp850: 2,
    cp852: 18,
    cp858: 19,
    cp860: 3,
    cp863: 4,
    cp865: 5,
    cp866: 17,
    cp1250: 35,
    cp1252: 16
  };

  return Buffer.from([ESC, 0x74, codepageMap[codepage.toLowerCase()] ?? 18]);
}

function parseSplitPayment(paymentMethod: string): Array<{ methodName: string; amount: number }> {
  if (!paymentMethod.includes("\n")) {
    return [];
  }

  return paymentMethod
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.match(/^(.+?):\s+(-?\d+(?:[.,]\d{1,2})?)\s+CZK$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      methodName: match[1].trim(),
      amount: Number.parseFloat(match[2].replace(",", "."))
    }))
    .filter((payment) => Number.isFinite(payment.amount));
}

function wrapText(text: string, maxWidth: number): string[] {
  if (!text) return [];
  if (text.length <= maxWidth) return [text];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
      continue;
    }

    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function formatDate(value: string): string {
  if (/^\d{2}-\d{2}-\d{4}/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

function formatMoney(amount: number, wholeIfInteger = false, currency = "CZK"): string {
  if (wholeIfInteger && Math.abs(Math.round(amount) - amount) < 0.005) {
    return `${Math.round(amount)} ${currency}`;
  }

  return `${amount.toFixed(2)} ${currency}`;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function padLine(left: string, right: string, charsPerLine: number): string {
  const totalLength = left.length + right.length;
  if (totalLength >= charsPerLine) {
    return right ? `${left} ${right}` : left;
  }

  return `${left}${" ".repeat(charsPerLine - totalLength)}${right}`;
}

function formatPlainLine(line: ReceiptLine, charsPerLine: number): string {
  const text = line.text;
  if ((line.align ?? "left") === "center") {
    const padding = Math.max(0, Math.floor((charsPerLine - text.length) / 2));
    return `${" ".repeat(padding)}${text}`;
  }

  if (line.align === "right" && text.length < charsPerLine) {
    return `${" ".repeat(charsPerLine - text.length)}${text}`;
  }

  return text;
}

function separator(charsPerLine: number): string {
  return "-".repeat(charsPerLine);
}

function dottedSeparator(charsPerLine: number): string {
  return ".".repeat(charsPerLine);
}

function firstString(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    const text = stringifyValue(value);
    if (text) {
      return text;
    }
  }

  return null;
}

function firstNumber(record: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    const parsed = parseNumber(value);
    if (typeof parsed === "number") {
      return parsed;
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
    if (!trimmed || (trimmed.startsWith("<") && trimmed.endsWith(">"))) {
      return null;
    }
    return trimmed;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
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
