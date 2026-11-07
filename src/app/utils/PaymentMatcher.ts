import type { ParsedPaymentEntry } from "./PaymentParser";

export interface PaymentReferenceRecord {
  id: string;
  requestId: string;
  reference: string;
  amount: number;
  userId: string;
  status: string;
  mechanicName?: string;
  note?: string;
}

export interface MatchedPaymentResult extends ParsedPaymentEntry {
  matchedReference?: PaymentReferenceRecord;
  requestId?: string;
  mechanicName?: string;
  debt?: number;
  amountDue?: number;
  remainingCredit?: number;
  resultType: "complete" | "partial" | "overpay" | "not_found";
  statusLabel: string;
  message: string;
}

export const matchParsedPayments = (
  parsedPayments: ParsedPaymentEntry[],
  references: PaymentReferenceRecord[]
): MatchedPaymentResult[] => {
  const referenceMap = new Map(
    references.map((item) => [String(item.reference).trim().toLowerCase(), item])
  );

  return parsedPayments.map((item) => {
    const matchedReference = referenceMap.get(String(item.reference).trim().toLowerCase());
    const debt = matchedReference?.amount ?? 0;
    const amountPaid = item.amountPaid;

    if (!matchedReference) {
      return {
        ...item,
        resultType: "not_found",
        statusLabel: "Não encontrado",
        message: "Referência não encontrada em pagamentos cadastrados.",
      };
    }

    if (amountPaid < debt) {
      return {
        ...item,
        matchedReference,
        requestId: matchedReference.requestId,
        mechanicName: matchedReference.mechanicName,
        debt,
        amountDue: debt - amountPaid,
        resultType: "partial",
        statusLabel: "Pagamento parcial",
        message: `Pagamento parcial identificado. Falta ${debt - amountPaid} Kz.`,
      };
    }

    if (amountPaid > debt) {
      return {
        ...item,
        matchedReference,
        requestId: matchedReference.requestId,
        mechanicName: matchedReference.mechanicName,
        debt,
        remainingCredit: amountPaid - debt,
        resultType: "overpay",
        statusLabel: "Excesso detectado",
        message: `Pagamento maior que o valor esperado. Crédito de ${amountPaid - debt} Kz.`,
      };
    }

    return {
      ...item,
      matchedReference,
      requestId: matchedReference.requestId,
      mechanicName: matchedReference.mechanicName,
      debt,
      resultType: "complete",
      statusLabel: "Pagamento completo",
      message: "Pagamento bate com o valor esperado.",
    };
  });
};
