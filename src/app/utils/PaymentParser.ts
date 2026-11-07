export interface ParsedPaymentEntry {
  reference: string;
  amountPaid: number;
  rawText: string;
  confidence: number;
  lineIndex: number;
}

export interface ParsedCustomPaymentEntry extends ParsedPaymentEntry {
  pastedStatus?: string;
}

export type ParserProgressCallback = (progress: number, status: string) => void;

const normalizeReportText = (text: string) =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ +/g, " ")
    .trim();

const parseAmountValue = (value: string) => {
  const normalized = value.replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

export const parseCustomPaymentList = (rawText: string): ParsedCustomPaymentEntry[] => {
  const rows = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\b(Pendente|Confirmado|Rejeitado)\s*[,;]\s*/gi, "$1\n")
    .split(/\n|;/)
    .map((row) => row.trim())
    .filter(Boolean);

  const parsedRows: ParsedCustomPaymentEntry[] = [];

  rows.forEach((row, lineIndex) => {
    const statusMatch = row.match(/\b(Pendente|Confirmado|Rejeitado)\s*$/i);
    const textBeforeStatus = statusMatch
      ? row.slice(0, statusMatch.index).trim()
      : row;
    const amountMatch = textBeforeStatus.match(/(\d[\d.,]*)\s*(?:Kz|AOA)?\s*$/i);
    if (!amountMatch) return;

    const textBeforeAmount = textBeforeStatus.slice(0, amountMatch.index).trim();
    const referenceMatches = Array.from(
      textBeforeAmount.matchAll(/[A-Za-z]{2,}[A-Za-z0-9]*-[A-Za-z0-9-]+|\b\d{5,}\b/g),
    );
    const reference = referenceMatches[referenceMatches.length - 1]?.[0];
    const amountPaid = parseAmountValue(amountMatch[1]);
    if (!reference || amountPaid <= 0) return;

    parsedRows.push({
      reference,
      amountPaid,
      rawText: row,
      confidence: 1,
      lineIndex,
      pastedStatus: statusMatch?.[1],
    });
  });

  const uniqueRows = new Map<string, ParsedCustomPaymentEntry>();
  for (const entry of parsedRows) {
    uniqueRows.set(`${entry.reference.toLowerCase()}:${entry.lineIndex}`, entry);
  }
  return [...uniqueRows.values()];
};

const createEntry = (
  reference: string,
  amount: string,
  rawText: string,
  lineIndex: number,
  confidence: number
): ParsedPaymentEntry | null => {
  const amountPaid = parseAmountValue(amount);
  const cleanedReference = reference.trim();

  if (!cleanedReference || amountPaid <= 0) {
    return null;
  }

  return {
    reference: cleanedReference,
    amountPaid,
    rawText,
    confidence,
    lineIndex,
  };
};

const addUniqueEntry = (
  entries: ParsedPaymentEntry[],
  entry: ParsedPaymentEntry
) => {
  const existingIndex = entries.findIndex(
    (item) => item.reference === entry.reference
  );

  if (existingIndex >= 0) {
    const existing = entries[existingIndex];
    if (entry.confidence > existing.confidence) {
      entries[existingIndex] = entry;
    }
  } else {
    entries.push(entry);
  }
};

export const parsePaymentReport = async (
  rawText: string,
  onProgress?: ParserProgressCallback
): Promise<ParsedPaymentEntry[]> => {
  const normalizedText = normalizeReportText(rawText);
  const lines = normalizedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const entries: ParsedPaymentEntry[] = [];

  const updateProgress = (step: number, total: number, status: string) => {
    if (!onProgress) return;
    onProgress(Math.min(100, Math.round((step / total) * 100)), status);
  };

  const fullPatterns = [
    {
      regex: /\b(?:ref(?:erencia)?|reference|referência)\s*[:=-]?\s*([A-Za-z0-9]{5,})\b[^0-9\n\r]{0,20}?([0-9]+(?:[.,][0-9]{1,2})?)/gi,
      confidence: 0.98,
      label: "Referência explicita com valor",
    },
    {
      regex: /([A-Za-z0-9]{5,})\b[^0-9\n\r]{0,20}?(?:valor|amount)\s*[:=-]?\s*([0-9]+(?:[.,][0-9]{1,2})?)/gi,
      confidence: 0.95,
      label: "Valor escrito após referência",
    },
    {
      regex: /([A-Za-z0-9]{5,})\s*[-,:]\s*([0-9]+(?:[.,][0-9]{1,2})?)/gi,
      confidence: 0.88,
      label: "Referência e valor separados por traço ou vírgula",
    },
    {
      regex: /([A-Za-z0-9]{5,})[^0-9\n\r]{1,20}?([0-9]{3,})/gi,
      confidence: 0.75,
      label: "Formato livre com referência e valor próximos",
    },
  ];

  let step = 0;
  const totalSteps = fullPatterns.length + 2;

  for (const pattern of fullPatterns) {
    updateProgress(step, totalSteps, `Buscando ${pattern.label}`);
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(normalizedText))) {
      const matchedText = match[0];
      const entry = createEntry(match[1], match[2], matchedText, lines.findIndex((line) => line.includes(matchedText)) ?? 0, pattern.confidence);
      if (entry) {
        addUniqueEntry(entries, entry);
      }
    }
    step += 1;
    await new Promise((resolve) => setTimeout(resolve, 8));
  }

  updateProgress(step, totalSteps, "Buscando combinações linha a linha");

  for (let index = 0; index < lines.length; index += 1) {
    const row = lines[index];
    const digits = Array.from(row.matchAll(/[A-Za-z0-9]{5,}|[0-9]+(?:[.,][0-9]{1,2})?/g)).map((item) => item[0]);

    if (digits.length >= 2) {
      const reference = digits[0];
      const amountCandidate = digits[1];
      const entry = createEntry(reference, amountCandidate, row, index, 0.8);
      if (entry) {
        addUniqueEntry(entries, entry);
      }
    }

    if (digits.length === 1 && index + 1 < lines.length) {
      const nextLine = lines[index + 1];
      const nextValue = nextLine.match(/[0-9]+(?:[.,][0-9]{1,2})?/);
      if (nextValue) {
        const entry = createEntry(digits[0], nextValue[0], `${row} ${nextLine}`, index, 0.7);
        if (entry) {
          addUniqueEntry(entries, entry);
        }
      }
    }

    if (index % 10 === 0) {
      updateProgress(step, totalSteps, `Analisando linha ${index + 1} de ${lines.length}`);
      await new Promise((resolve) => setTimeout(resolve, 3));
    }
  }

  step += 1;
  updateProgress(step, totalSteps, "Verificando correspondências inteligentes");

  if (entries.length === 0) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const referenceMatch = line.match(/([A-Za-z0-9]{5,})/);
      const amountMatch = line.match(/([0-9]+(?:[.,][0-9]{1,2})?)/g);
      if (referenceMatch && amountMatch && amountMatch.length > 1) {
        const reference = referenceMatch[1];
        const amount = amountMatch.find((value) => !value.startsWith(reference)) || amountMatch[1];
        const entry = createEntry(reference, amount, line, index, 0.65);
        if (entry) {
          addUniqueEntry(entries, entry);
        }
      }
      if (index % 10 === 0) {
        updateProgress(step, totalSteps, `Procurando formatos alternativos… (${index + 1}/${lines.length})`);
        await new Promise((resolve) => setTimeout(resolve, 3));
      }
    }
  }

  step += 1;
  updateProgress(step, totalSteps, "Análise concluída");

  return entries.sort((a, b) => a.lineIndex - b.lineIndex || b.confidence - a.confidence);
};
