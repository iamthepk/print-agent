import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

type UnknownRecord = Record<string, unknown>;

const RECEIPT_WIDTH_PT = 226;
const RECEIPT_HEIGHT_PT = 1000;
const DEFAULT_TOP_MARGIN = 10;
const DEFAULT_LEFT_MARGIN = 0;
const DEFAULT_RIGHT_MARGIN = 0;

interface ReceiptPdfOptions {
  pdfTopMargin?: number;
  pdfLeftMargin?: number;
  pdfRightMargin?: number;
}

interface ReceiptTemplateLabels {
  refundReceipt: string;
  receiptNumber: string;
  refundedReceiptNumber: string;
  customer: string;
  walkInCustomer: string;
  date: string;
  itemsCount: string;
  subtotal: string;
  tax: string;
  discount: string;
  saved: string;
  rounding: string;
  total: string;
  exchangeRate: string;
  refundedAmount: string;
  paidAmount: string;
  paidAmountSentence: string;
  givenAmount: string;
  change: string;
  payment: string;
  cardPayment: string;
  defaultPayment: string;
}

interface ReceiptTemplateLayout {
  widthPt: number;
  heightPt: number;
  topMarginPt: number;
  bottomMarginPt: number;
  leftMarginPt: number;
  rightMarginPt: number;
  rightColumnStartPt: number;
  logoWidthPt: number;
  qrSizePt: number;
  showOrderNumber: boolean;
  showLogo: boolean;
  showCompany: boolean;
  showQr: boolean;
  showFooter: boolean;
}

interface ReceiptTemplateConfig {
  currency: string;
  secondaryCurrency: string;
  labels: ReceiptTemplateLabels;
  layout: ReceiptTemplateLayout;
}

const DEFAULT_RECEIPT_LABELS: ReceiptTemplateLabels = {
  refundReceipt: "REFUND RECEIPT",
  receiptNumber: "Receipt No.",
  refundedReceiptNumber: "Refunded Receipt No.",
  customer: "Customer",
  walkInCustomer: "Walk-in Customer",
  date: "Date",
  itemsCount: "Items Count",
  subtotal: "Subtotal",
  tax: "Tax",
  discount: "Discount",
  saved: "You saved {amount}!",
  rounding: "ROUNDING",
  total: "TOTAL",
  exchangeRate: "Exchange rate",
  refundedAmount: "Refunded amount",
  paidAmount: "PAID AMOUNT",
  paidAmountSentence: "Paid amount",
  givenAmount: "Given amount",
  change: "Change",
  payment: "Payment",
  cardPayment: "Card",
  defaultPayment: "Card - Contactless"
};

const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplateConfig = {
  currency: "CZK",
  secondaryCurrency: "EUR",
  labels: DEFAULT_RECEIPT_LABELS,
  layout: {
    widthPt: RECEIPT_WIDTH_PT,
    heightPt: RECEIPT_HEIGHT_PT,
    topMarginPt: DEFAULT_TOP_MARGIN,
    bottomMarginPt: 38,
    leftMarginPt: DEFAULT_LEFT_MARGIN,
    rightMarginPt: DEFAULT_RIGHT_MARGIN,
    rightColumnStartPt: 130,
    logoWidthPt: 120,
    qrSizePt: 120,
    showOrderNumber: true,
    showLogo: true,
    showCompany: true,
    showQr: true,
    showFooter: true
  }
};

export async function generateReceiptPdf(
  payload: unknown,
  outputDir: string,
  options: ReceiptPdfOptions = {}
): Promise<string> {
  const order = normalizeReceiptPayload(payload);
  const template = resolveReceiptTemplate(order);
  const pdfPath = path.join(
    outputDir,
    `receipt-dynamic-${Date.now()}-${Math.random().toString(16).slice(2)}.pdf`
  );
  const logoBuffer = template.layout.showLogo
    ? await loadRemoteImage(firstString(order, ["company_logo"]))
    : null;
  const qrCodeBuffer = template.layout.showQr
    ? await loadRemoteImage(firstString(order, ["company_google_reviews_qr_code", "company_qr"]))
    : null;

  await new Promise<void>((resolve, reject) => {
    const topMargin = options.pdfTopMargin ?? template.layout.topMarginPt;
    const leftMargin = options.pdfLeftMargin ?? template.layout.leftMarginPt;
    const rightMargin = options.pdfRightMargin ?? template.layout.rightMarginPt;
    const baseX = leftMargin;
    const contentWidth = template.layout.widthPt - leftMargin - rightMargin;
    const leftColumnWidth = Math.min(
      template.layout.rightColumnStartPt,
      Math.max(80, contentWidth - 40)
    );
    const rightColStart = baseX + leftColumnWidth;
    const rightColumnWidth = Math.max(40, contentWidth - leftColumnWidth);
    const fallbackFont = "Helvetica";
    const fontName = "Bebas Neue";

    const doc = new PDFDocument({
      size: [template.layout.widthPt, template.layout.heightPt],
      margins: {
        top: topMargin,
        bottom: template.layout.bottomMarginPt,
        left: leftMargin,
        right: rightMargin
      }
    });
    const stream = createWriteStream(pdfPath);

    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);

    const fontPath = findBebasNeueFontPath();
    const primaryFont = fontPath ? fontName : fallbackFont;
    if (fontPath) {
      doc.registerFont(fontName, fontPath);
    }

    const gap = (pt: number) => {
      doc.y += pt;
    };
    const hr = (above = 2, below = 2) => {
      gap(above);
      doc.moveTo(baseX, doc.y).lineTo(baseX + contentWidth, doc.y).stroke();
      gap(below);
    };
    const dashedSeparator = (y: number) => {
      doc
        .dash(1, { space: 2 })
        .moveTo(baseX, y)
        .lineTo(baseX + contentWidth, y)
        .stroke()
        .undash();
    };
    const centerText = (text: string, fontSize = 10, font = primaryFont) => {
      doc.fontSize(fontSize).font(font).text(text, baseX, doc.y, {
        width: contentWidth,
        align: "center"
      });
    };
    const leftRightText = (
      leftText: string,
      rightText: string,
      fontSize = 10,
      font = primaryFont
    ) => {
      const startY = doc.y;
      doc.fontSize(fontSize).font(font);
      doc.text(leftText, baseX, startY, { width: leftColumnWidth, align: "left" });
      doc.text(rightText, rightColStart, startY, {
        width: rightColumnWidth,
        align: "right"
      });
      doc.y = startY + doc.heightOfString(leftText, { width: leftColumnWidth });
    };
    const leftRightTextWithCurrency = (
      leftText: string,
      amount: string,
      currency = template.currency,
      fontSize = 10,
      font = primaryFont
    ) => {
      const startY = doc.y;
      doc.fontSize(fontSize).font(font);
      doc.text(leftText, baseX, startY, { width: leftColumnWidth, align: "left" });
      doc.text(`${amount} ${currency}`, rightColStart, startY, {
        width: rightColumnWidth,
        align: "right"
      });
      doc.y = startY + doc.heightOfString(leftText, { width: leftColumnWidth });
    };

    const orderNumber = firstString(order, ["orderNumber", "order_number", "orderId"]);
    if (template.layout.showOrderNumber && orderNumber) {
      const orderText = `#${orderNumber}`;
      let fontSize = 30;
      const minFontSize = 18;
      doc.fontSize(fontSize).font(primaryFont);
      const textWidth = doc.widthOfString(orderText);
      if (textWidth > contentWidth) {
        fontSize = Math.max(minFontSize, Math.floor((contentWidth / textWidth) * fontSize));
        doc.fontSize(fontSize);
      }
      doc.text(orderText, baseX, doc.y, { width: contentWidth, align: "right" });
    }

    const logoStartY = doc.y;
    const logoWidthPoints = template.layout.logoWidthPt;
    const logoX = baseX + (contentWidth - logoWidthPoints) / 2;
    let hasLogoImage = false;

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, logoX, logoStartY, {
          width: logoWidthPoints,
          fit: [logoWidthPoints, logoWidthPoints * 2]
        });
        doc.y = logoStartY + logoWidthPoints * 0.8 + 8;
        hasLogoImage = true;
        gap(2);
      } catch {
        hasLogoImage = false;
      }
    }

    if (template.layout.showCompany) {
      const companyName = firstString(order, ["company_name", "headerText", "companyName"]);
      if (companyName) {
        centerText(companyName, hasLogoImage ? 18 : 25, primaryFont);
        gap(hasLogoImage ? 4 : 2);
      }

      const companyLines = [
        firstString(order, ["company_VAT", "companyVat", "dic", "ico"]),
        firstString(order, ["company_address", "companyAddress"]),
        joinNonEmpty([
          firstString(order, ["company_city", "companyCity"]),
          firstString(order, ["company_poscode", "companyPostalCode", "company_postal_code"])
        ]),
        firstString(order, ["company_country", "companyCountry"]),
        firstString(order, ["company_phone", "companyPhone"]),
        firstString(order, ["company_email", "companyEmail"]),
        firstString(order, ["company_website", "companyWebsite"])
      ].filter((line): line is string => Boolean(line));

      for (const line of companyLines) {
        centerText(line, 11);
      }
      if (hasLogoImage || companyName || companyLines.length > 0) {
        gap(4);
      }
    }

    const totalCZK =
      firstNumber(order, [
        "totalCZK",
        "total_czk",
        "total",
        "totalAmount",
        "total_amount",
        "grandTotal",
        "grand_total"
      ]) ?? 0;
    const isRefund =
      order.isRefund === true ||
      firstString(order, ["kind"]) === "refund_receipt" ||
      totalCZK < 0;

    if (isRefund) {
      centerText(template.labels.refundReceipt, 20, primaryFont);
      gap(2);
    }

    const receiptNumber =
      firstString(order, ["receiptNumber", "receipt_number"]) ?? orderNumber;
    const originalReceiptNumber = firstString(order, [
      "originalReceiptNumber",
      "original_receipt_number"
    ]);
    const customerName = firstString(order, ["customerName", "customer_name"]);
    const createdAt = firstString(order, ["displayCreatedAt", "createdAt", "created_at"]);

    doc.font(primaryFont).fontSize(12);
    const previousLineGap = getLineGap(doc);
    doc.lineGap(-3);
    const row = (text: string) => {
      const y = doc.y;
      doc.text(text, baseX, y, { width: contentWidth, align: "left" });
      doc.y = y + doc.currentLineHeight(true);
    };
    if (receiptNumber) row(`${template.labels.receiptNumber}: ${receiptNumber}`);
    if (originalReceiptNumber) {
      row(`${template.labels.refundedReceiptNumber}: ${originalReceiptNumber}`);
    }
    if (customerName && customerName !== template.labels.walkInCustomer) {
      row(`${template.labels.customer}: ${customerName}`);
    }
    if (createdAt) row(`${template.labels.date}: ${formatDate(createdAt)}`);
    doc.lineGap(previousLineGap);

    hr(0, 2);

    let itemCount = 0;
    const items = asArray(order.items);
    items.forEach((itemValue, index) => {
      const item = asRecord(itemValue) ?? {};
      const qty = firstNumber(item, ["qty", "quantity"]) ?? 1;
      const unitPrice = firstNumber(item, ["unitPrice", "unit_price", "price"]) ?? 0;
      const itemTotal =
        firstNumber(item, ["lineTotal", "totalPrice", "total"]) ?? qty * unitPrice;
      const displayUnitPrice = isRefund ? -Math.abs(unitPrice) : unitPrice;
      const displayItemTotal = isRefund ? -Math.abs(itemTotal) : itemTotal;
      const itemName = firstString(item, ["name", "productName", "title"]) ?? "";

      itemCount += qty;
      doc.fontSize(11).font(primaryFont);

      const itemStartY = doc.y;
      doc.text(itemName, baseX, itemStartY, { width: contentWidth, align: "left" });
      doc.y = itemStartY + doc.heightOfString(itemName, { width: contentWidth });

      let lastLineY = doc.y - doc.currentLineHeight(true);
      if (qty > 1) {
        leftRightText(`${formatQuantity(qty)} x ${formatMoney(displayUnitPrice, template.currency)}`, "");
        lastLineY = doc.y - doc.currentLineHeight(true);
      }

      doc.text(formatMoney(displayItemTotal, template.currency), baseX, lastLineY, {
        width: contentWidth,
        align: "right"
      });
      doc.y = lastLineY + doc.currentLineHeight(true);

      if (index < items.length - 1) {
        dashedSeparator(doc.y + 1);
        doc.y += 2;
      }
    });

    hr(0, 2);
    leftRightText(`${template.labels.itemsCount}: ${formatQuantity(itemCount)}`, "");
    hr();

    const subtotal = firstNumber(order, ["subtotal"]);
    if (typeof subtotal === "number" && Math.abs(subtotal - totalCZK) > 0.005) {
      const displaySubtotal = isRefund ? -Math.abs(subtotal) : subtotal;
      leftRightText(`${template.labels.subtotal}:`, formatMoney(displaySubtotal, template.currency));
    }

    const taxItems = asArray(order.vat);
    for (const vatValue of taxItems.length > 0 ? taxItems : asArray(order.taxes)) {
      const vatItem = asRecord(vatValue);
      if (!vatItem) continue;
      const rate = firstNumber(vatItem, ["rate"]);
      const amount = firstNumber(vatItem, ["amount"]);
      if (typeof rate !== "number" || typeof amount !== "number") continue;
      const displayVatAmount = isRefund ? -Math.abs(amount) : amount;
      leftRightText(
        `${template.labels.tax} ${formatQuantity(rate)}%:`,
        formatMoney(displayVatAmount, template.currency)
      );
    }

    const discountAmount = firstNumber(order, ["discountAmount", "discount_amount"]);
    if (typeof discountAmount === "number" && discountAmount > 0) {
      let discountLabel = template.labels.discount;
      const discountPercent = firstNumber(order, ["discountPercent", "discount_percent"]);
      const discountName = firstString(order, ["discountName", "discount_name"]);
      const discountType = firstString(order, ["discountType", "discount_type"]);

      if (typeof discountPercent === "number" && discountPercent > 0) {
        discountLabel = `${template.labels.discount} ${formatQuantity(discountPercent)}%`;
      } else if (discountName) {
        discountLabel = `${template.labels.discount} (${discountName})`;
      } else if (discountType === "fixed") {
        discountLabel = `${template.labels.discount} ${formatMoney(
          Math.round(discountAmount),
          template.currency,
          true
        )}`;
      }

      leftRightText(`${discountLabel}:`, `-${formatMoney(discountAmount, template.currency)}`);
      doc.font(primaryFont).fontSize(11).fillColor("#666666");
      const y = doc.y;
      doc.text(
        applyLabelTemplate(template.labels.saved, {
          amount: formatMoney(discountAmount, template.currency)
        }),
        baseX,
        y,
        {
          width: contentWidth,
          align: "center"
        }
      );
      doc.y = y + doc.currentLineHeight(true);
      doc.fillColor("#000000").fontSize(13);
    }

    const rawRounding = firstNumber(order, ["rounding", "cashRounding", "roundingCZK"]);
    const rounding = rawRounding ?? 0;
    const displayTotal = isRefund ? -Math.abs(totalCZK) : totalCZK;
    const roundingDisplay = isRefund ? -Math.abs(rounding) : rounding;
    const payable = displayTotal + roundingDisplay;

    if (rounding !== 0) {
      leftRightText(`${template.labels.rounding}:`, formatMoney(roundingDisplay, template.currency));
    }

    hr(0, 2);
    const totalFormatted = isWholeAmount(payable) ? String(Math.round(payable)) : payable.toFixed(2);
    leftRightTextWithCurrency(
      `${template.labels.total}:`,
      totalFormatted,
      template.currency,
      15,
      primaryFont
    );

    const totalEUR = firstNumber(order, [
      "totalEUR",
      "total_eur",
      "secondaryTotal",
      "secondary_total"
    ]);
    if (typeof totalEUR === "number") {
      const displayTotalEUR = isRefund ? -Math.abs(totalEUR) : totalEUR;
      doc.font(primaryFont).fontSize(12);
      const y = doc.y;
      doc.text(`= ${formatMoney(displayTotalEUR, template.secondaryCurrency)}`, baseX, y, {
        width: contentWidth,
        align: "right"
      });
      doc.y = y + doc.currentLineHeight(true);
    }

    hr(0, 2);
    doc.fontSize(15).font(primaryFont);
    appendPaymentLines(order, isRefund, totalCZK, displayTotal, template, leftRightText);

    const exchangeRate = firstString(order, ["exchangeRate", "exchange_rate"]);
    if (exchangeRate) {
      centerText(`${template.labels.exchangeRate}: ${exchangeRate}`, 12);
      gap(2);
    }

    gap(2);
    if (template.layout.showQr && qrCodeBuffer) {
      const qrTextAbove = firstString(order, ["qr_text_above", "qrTextAbove"]);
      if (qrTextAbove) {
        centerText(qrTextAbove, 18);
        gap(2);
      }

      try {
        const qrWidthPoints = template.layout.qrSizePt;
        const qrX = baseX + (contentWidth - qrWidthPoints) / 2;
        doc.image(qrCodeBuffer, qrX, doc.y, {
          width: qrWidthPoints,
          height: qrWidthPoints
        });
        doc.y += qrWidthPoints + 2;

        const qrTextBelow = firstString(order, ["qr_text_below", "qrTextBelow"]);
        if (qrTextBelow) {
          gap(2);
          centerText(qrTextBelow, 18);
        }
      } catch {
        // Keep printing the receipt even when the QR cannot be rendered.
      }
    }

    if (template.layout.showFooter) {
      const footerCustomText = firstString(order, ["footer_custom_text", "footerCustomText"]);
      const footerSocialText = firstString(order, ["footer_social_text", "footerSocialText"]);
      const footerSocialHandle = firstString(order, [
        "footer_social_handle",
        "footerSocialHandle"
      ]);

      if (footerCustomText) {
        centerText(footerCustomText, 18);
        gap(2);
      }
      if (footerSocialText) {
        centerText(footerSocialText, 11);
      }
      if (footerSocialHandle) {
        centerText(footerSocialHandle, 11);
      }
    }

    gap(2);
    doc.end();
  });

  return pdfPath;
}

function normalizeReceiptPayload(payload: unknown): UnknownRecord {
  const root = asRecord(payload) ?? {};
  const nestedReceipt = asRecord(root.receipt);
  const flattened = omitUndefined({
    ...root,
    ...(asRecord(root.company) ?? {}),
    ...(asRecord(root.totals) ?? {}),
    ...(asRecord(root.refund) ?? {})
  });

  if (!nestedReceipt) {
    return flattened;
  }

  return omitUndefined({
    ...flattened,
    ...nestedReceipt
  });
}

async function loadRemoteImage(value: string | null): Promise<Buffer | null> {
  if (!value || !/^https?:\/\//i.test(value)) {
    return null;
  }

  try {
    const response = await fetch(value);
    if (!response.ok) {
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function appendPaymentLines(
  order: UnknownRecord,
  isRefund: boolean,
  totalCZK: number,
  displayTotal: number,
  template: ReceiptTemplateConfig,
  leftRightText: (leftText: string, rightText: string, fontSize?: number, font?: string) => void
): void {
  if (isRefund) {
    const paymentMethod = resolvePaymentMethodName(order, template);
    leftRightText(`${paymentMethod}:`, formatMoney(displayTotal, template.currency));
    leftRightText(`${template.labels.refundedAmount}:`, formatMoney(displayTotal, template.currency));
    return;
  }

  const payments = asArray(order.payments)
    .map((paymentValue) => asRecord(paymentValue))
    .filter((payment): payment is UnknownRecord => payment !== null);
  if (payments.length > 0) {
    for (const payment of payments) {
      const method = firstString(payment, ["method", "methodName", "name"]) ?? template.labels.payment;
      const amount = firstNumber(payment, ["amount"]) ?? totalCZK;
      leftRightText(`${method}:`, formatMoney(amount, template.currency));
    }
    leftRightText(`${template.labels.paidAmount}:`, formatMoney(totalCZK, template.currency));
    return;
  }

  const rawPayment = firstString(order, ["paymentMethod", "payment_method"]);
  const splitPayment = parseSplitPayment(rawPayment, template.currency);
  if (splitPayment.length > 0) {
    for (const payment of splitPayment) {
      const displayName = resolvePaymentMethodName(
        {
          ...order,
          paymentMethod: payment.methodName
        },
        template
      );
      leftRightText(`${displayName}:`, formatMoney(payment.amount, template.currency));
    }
    leftRightText(`${template.labels.paidAmount}:`, formatMoney(totalCZK, template.currency));
    return;
  }

  const paymentMethodResolved = resolvePaymentMethodName(order, template);
  const paymentMethod =
    paymentMethodResolved === template.labels.cardPayment ||
    paymentMethodResolved === template.labels.defaultPayment
      ? template.labels.defaultPayment
      : paymentMethodResolved || template.labels.defaultPayment;
  leftRightText(`${paymentMethod}:`, formatMoney(totalCZK, template.currency));

  const givenAmount = firstNumber(order, ["givenAmount", "given_amount"]);
  const change = firstNumber(order, ["change"]);
  if (typeof givenAmount === "number" && givenAmount > 0) {
    leftRightText(`${template.labels.givenAmount}:`, formatMoney(givenAmount, template.currency));
    if (typeof change === "number" && change > 0) {
      leftRightText(`${template.labels.change}:`, formatMoney(change, template.currency));
    }
  } else {
    leftRightText(`${template.labels.paidAmountSentence}:`, formatMoney(totalCZK, template.currency));
  }
}

function resolvePaymentMethodName(order: UnknownRecord, template: ReceiptTemplateConfig): string {
  const raw = firstString(order, ["paymentMethod", "payment_method"]);
  if (!raw) return template.labels.defaultPayment;

  const map = order.paymentMethods ?? order.payment_methods;
  if (/^\d+$/.test(raw.trim())) {
    const id = raw.trim();
    const recordMap = asRecord(map);
    if (recordMap && typeof recordMap[id] === "string") {
      return recordMap[id] as string;
    }
    if (Array.isArray(map)) {
      const entry = map.find((item) => {
        const record = asRecord(item);
        return record && String(record.id) === id;
      });
      const name = asRecord(entry)?.name;
      if (typeof name === "string" && name) {
        return name;
      }
    }
  }

  return raw;
}

function parseSplitPayment(
  paymentMethod: string | null,
  currency: string
): Array<{ methodName: string; amount: number }> {
  if (!paymentMethod?.includes("\n")) {
    return [];
  }

  const currencyPattern = escapeRegExp(currency);
  return paymentMethod
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.match(new RegExp(`^(.+?):\\s+(-?\\d+(?:[.,]\\d{1,2})?)\\s+${currencyPattern}$`))
    )
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      methodName: match[1].trim(),
      amount: Number.parseFloat(match[2].replace(",", "."))
    }))
    .filter((payment) => Number.isFinite(payment.amount));
}

function formatDate(value: string): string {
  if (!value) return value;
  if (/^\d{2}-\d{2}-\d{4}/.test(value)) return value;

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  }

  return value;
}

function resolveReceiptTemplate(order: UnknownRecord): ReceiptTemplateConfig {
  const template =
    asRecord(order.template) ??
    asRecord(order.printTemplate) ??
    asRecord(order.receiptTemplate) ??
    {};

  return {
    currency:
      firstString(template, ["currency", "primaryCurrency", "primary_currency"]) ??
      firstString(order, ["currency", "currencyCode", "currency_code"]) ??
      DEFAULT_RECEIPT_TEMPLATE.currency,
    secondaryCurrency:
      firstString(template, ["secondaryCurrency", "secondary_currency"]) ??
      firstString(order, ["secondaryCurrency", "secondary_currency"]) ??
      DEFAULT_RECEIPT_TEMPLATE.secondaryCurrency,
    labels: resolveReceiptLabels(asRecord(template.labels)),
    layout: resolveReceiptLayout(asRecord(template.layout))
  };
}

function resolveReceiptLabels(overrides: UnknownRecord | null): ReceiptTemplateLabels {
  return Object.fromEntries(
    Object.entries(DEFAULT_RECEIPT_LABELS).map(([key, fallback]) => [
      key,
      firstString(overrides ?? {}, [key]) ?? fallback
    ])
  ) as unknown as ReceiptTemplateLabels;
}

function resolveReceiptLayout(overrides: UnknownRecord | null): ReceiptTemplateLayout {
  const defaults = DEFAULT_RECEIPT_TEMPLATE.layout;

  return {
    widthPt: boundedNumber(overrides, ["widthPt", "width_pt", "width"], defaults.widthPt, 160, 400),
    heightPt: boundedNumber(
      overrides,
      ["heightPt", "height_pt", "height"],
      defaults.heightPt,
      300,
      3000
    ),
    topMarginPt: boundedNumber(
      overrides,
      ["topMarginPt", "top_margin_pt", "topMargin"],
      defaults.topMarginPt,
      0,
      80
    ),
    bottomMarginPt: boundedNumber(
      overrides,
      ["bottomMarginPt", "bottom_margin_pt", "bottomMargin"],
      defaults.bottomMarginPt,
      0,
      120
    ),
    leftMarginPt: boundedNumber(
      overrides,
      ["leftMarginPt", "left_margin_pt", "leftMargin"],
      defaults.leftMarginPt,
      0,
      60
    ),
    rightMarginPt: boundedNumber(
      overrides,
      ["rightMarginPt", "right_margin_pt", "rightMargin"],
      defaults.rightMarginPt,
      0,
      60
    ),
    rightColumnStartPt: boundedNumber(
      overrides,
      ["rightColumnStartPt", "right_column_start_pt", "rightColumnStart"],
      defaults.rightColumnStartPt,
      80,
      260
    ),
    logoWidthPt: boundedNumber(
      overrides,
      ["logoWidthPt", "logo_width_pt", "logoWidth"],
      defaults.logoWidthPt,
      40,
      220
    ),
    qrSizePt: boundedNumber(overrides, ["qrSizePt", "qr_size_pt", "qrSize"], defaults.qrSizePt, 40, 220),
    showOrderNumber:
      firstBoolean(overrides ?? {}, ["showOrderNumber", "show_order_number"]) ??
      defaults.showOrderNumber,
    showLogo: firstBoolean(overrides ?? {}, ["showLogo", "show_logo"]) ?? defaults.showLogo,
    showCompany:
      firstBoolean(overrides ?? {}, ["showCompany", "show_company"]) ?? defaults.showCompany,
    showQr: firstBoolean(overrides ?? {}, ["showQr", "show_qr"]) ?? defaults.showQr,
    showFooter: firstBoolean(overrides ?? {}, ["showFooter", "show_footer"]) ?? defaults.showFooter
  };
}

function boundedNumber(
  record: UnknownRecord | null,
  keys: string[],
  fallback: number,
  min: number,
  max: number
): number {
  const value = firstNumber(record ?? {}, keys);
  if (typeof value !== "number") {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function applyLabelTemplate(label: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${escapeRegExp(key)}\\}`, "g"), value),
    label
  );
}

function findBebasNeueFontPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "assets", "fonts", "BebasNeue-Regular.ttf"),
    path.resolve(process.resourcesPath ?? "", "assets", "fonts", "BebasNeue-Regular.ttf"),
    path.resolve(path.dirname(process.execPath), "resources", "assets", "fonts", "BebasNeue-Regular.ttf")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function joinNonEmpty(parts: Array<string | null>): string | null {
  const joined = parts.filter((part): part is string => Boolean(part)).join(" ");
  return joined || null;
}

function formatMoney(amount: number, currency: string, wholeIfInteger = false): string {
  const value = wholeIfInteger && isWholeAmount(amount)
    ? String(Math.round(amount))
    : amount.toFixed(2);
  return `${value} ${currency}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstString(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    const text = stringifyValue(value);
    if (text) return text;
  }

  return null;
}

function firstNumber(record: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    const parsed = parseNumber(value);
    if (typeof parsed === "number") return parsed;
  }

  return null;
}

function firstBoolean(record: UnknownRecord, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
  }

  return null;
}

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || (trimmed.startsWith("<") && trimmed.endsWith(">"))) return null;
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
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

function isWholeAmount(amount: number, tolerance = 0.005): boolean {
  return Math.abs(Math.round(amount) - amount) < tolerance;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function omitUndefined(record: UnknownRecord): UnknownRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  );
}

function getLineGap(doc: PDFKit.PDFDocument): number {
  return (doc as unknown as { _lineGap?: number })._lineGap ?? 0;
}
