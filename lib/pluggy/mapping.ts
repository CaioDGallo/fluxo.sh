import type { InstallmentInfo } from '@/lib/import/types';
import type { Transaction } from 'pluggy-sdk';

export type PluggyTransactionDirection = 'credit' | 'debit';

export type PluggyTransactionClassification = {
  direction: PluggyTransactionDirection;
  kind: 'payment' | 'refund' | 'expense' | 'income';
  isFaturaPayment: boolean;
  isPairCandidate: boolean;
  installmentInfo?: InstallmentInfo;
  normalizedDescription: string;
};

const INSTALLMENT_PATTERN = /(parcela|parc|parcelado)\s*(\d+)\s*[\/-]\s*(\d+)/i;
const PAYMENT_PATTERN = /(pag(?:amento|to)?\s+(?:de\s+)?(?:fatura|cartao|cart[aã]o)|pgto?\s+(?:de\s+)?(?:fatura|cartao)|fatura\s+cartao|bill\s+payment)/i;
const PAYMENT_OPERATION_TYPES = new Set([
  'PAGAMENTO', 'PAGAMENTO_FATURA', 'PAGAMENTO_BOLETO',
  'PAGAMENTO_CONTA', 'DEBITO_AUTOMATICO',
]);
const TRANSFER_PATTERN = /(transferencia|transf\b|pix|ted|doc)/i;
const DEPOSIT_PATTERN = /(deposito|deposit)/i;
const WITHDRAW_PATTERN = /(saque|withdrawal)/i;
const REFUND_PATTERN = /(estorno|reembolso|refund|chargeback|credito\s+de)/i;
const TRANSFER_METHODS = new Set(['PIX', 'TED', 'DOC', 'TRANSFERENCIA', 'TRANSFERENCIA_MESMA_INSTITUICAO']);
const DEPOSIT_TYPES = new Set(['DEPOSITO']);
const WITHDRAW_TYPES = new Set(['SAQUE']);

function normalizeDescription(description: string | null | undefined): string {
  return (description ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveDirection(transaction: Transaction): PluggyTransactionDirection {
  if (transaction.type === 'CREDIT') return 'credit';
  if (transaction.type === 'DEBIT') return 'debit';
  const amount = transaction.amount ?? 0;
  return amount < 0 ? 'debit' : 'credit';
}

function extractInstallmentInfoFromMetadata(metadata?: { number?: number | null; total?: number | null } | null, description?: string | null): InstallmentInfo | undefined {
  const current = metadata?.number ?? null;
  const total = metadata?.total ?? null;
  if (!current || !total) {
    return undefined;
  }
  return {
    current,
    total,
    baseDescription: (description ?? '').trim(),
  };
}

export function extractPluggyInstallmentInfo(transaction: Transaction): InstallmentInfo | undefined {
  const metadata = transaction.creditCardMetadata
    ? { number: transaction.creditCardMetadata.installmentNumber, total: transaction.creditCardMetadata.totalInstallments }
    : undefined;

  const fromMetadata = extractInstallmentInfoFromMetadata(metadata ?? undefined, transaction.description);
  if (fromMetadata) {
    return fromMetadata;
  }

  const normalized = normalizeDescription(transaction.description);
  const match = normalized.match(INSTALLMENT_PATTERN);
  if (!match) {
    return undefined;
  }

  const current = Number(match[2]);
  const total = Number(match[3]);
  if (!Number.isFinite(current) || !Number.isFinite(total)) {
    return undefined;
  }

  const baseDescription = normalized.replace(match[0], '').trim();
  return {
    current,
    total,
    baseDescription,
  };
}

export function isPluggyRefundCandidate(transaction: Transaction, direction?: PluggyTransactionDirection): boolean {
  const normalized = normalizeDescription(transaction.description);
  const inferredDirection = direction ?? resolveDirection(transaction);
  return inferredDirection === 'credit' && REFUND_PATTERN.test(normalized);
}

export function classifyPluggyTransaction(transaction: Transaction): PluggyTransactionClassification {
  const direction = resolveDirection(transaction);
  const normalizedDescription = normalizeDescription(transaction.description);
  const installmentInfo = extractPluggyInstallmentInfo(transaction);
  const paymentMethod = transaction.paymentData?.paymentMethod?.toUpperCase();
  const operationType = transaction.operationType?.toUpperCase();

  // Refunds always take priority
  if (isPluggyRefundCandidate(transaction, direction)) {
    return {
      direction,
      kind: 'refund',
      isFaturaPayment: false,
      isPairCandidate: false,
      installmentInfo,
      normalizedDescription,
    };
  }

  // Fatura payment detection — structural signals first, regex fallback
  const hasBoletoMetadata = !!(
    transaction.paymentData?.boletoMetadata?.digitableLine ||
    transaction.paymentData?.boletoMetadata?.barcode
  );
  const hasPaymentOperationType = !!(operationType && PAYMENT_OPERATION_TYPES.has(operationType));

  if (hasBoletoMetadata || hasPaymentOperationType || PAYMENT_PATTERN.test(normalizedDescription)) {
    return {
      direction,
      kind: 'payment',
      isFaturaPayment: true,
      isPairCandidate: false,
      installmentInfo,
      normalizedDescription,
    };
  }

  // Deposit: DEPOSITO operation type or description pattern (credit only)
  if ((operationType && DEPOSIT_TYPES.has(operationType) && direction === 'credit') ||
      (DEPOSIT_PATTERN.test(normalizedDescription) && direction === 'credit')) {
    return {
      direction,
      kind: 'income',
      isFaturaPayment: false,
      isPairCandidate: false,
      installmentInfo,
      normalizedDescription,
    };
  }

  // Withdrawal: SAQUE operation type or description pattern (debit only)
  if ((operationType && WITHDRAW_TYPES.has(operationType) && direction === 'debit') ||
      (WITHDRAW_PATTERN.test(normalizedDescription) && direction === 'debit')) {
    return {
      direction,
      kind: 'expense',
      isFaturaPayment: false,
      isPairCandidate: false,
      installmentInfo,
      normalizedDescription,
    };
  }

  // PIX/TED/DOC/TRANSFERENCIA: regular expense or income, but flagged as pair candidate
  // for cross-account internal transfer detection
  const usesTransferMethod =
    (paymentMethod && TRANSFER_METHODS.has(paymentMethod)) ||
    (operationType && TRANSFER_METHODS.has(operationType)) ||
    TRANSFER_PATTERN.test(normalizedDescription);

  if (usesTransferMethod) {
    return {
      direction,
      kind: direction === 'credit' ? 'income' : 'expense',
      isFaturaPayment: false,
      isPairCandidate: true,
      installmentInfo,
      normalizedDescription,
    };
  }

  // Default: direction-based
  return {
    direction,
    kind: direction === 'credit' ? 'income' : 'expense',
    isFaturaPayment: false,
    isPairCandidate: false,
    installmentInfo,
    normalizedDescription,
  };
}
