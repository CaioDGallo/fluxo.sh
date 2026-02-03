import type { InstallmentInfo } from '@/lib/import/types';

export type TransferType = 'fatura_payment' | 'internal_transfer' | 'deposit' | 'withdrawal';

export type PluggyTransaction = {
  id?: string | null;
  description?: string | null;
  amount?: number | null;
  type?: string | null;
  paymentData?: { paymentMethod?: string | null } | null;
  operationType?: string | null;
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
  } | null;
  installment?: { number?: number | null; total?: number | null } | null;
  installments?: { number?: number | null; total?: number | null } | null;
};

export type PluggyTransactionDirection = 'credit' | 'debit';

export type PluggyTransactionClassification = {
  direction: PluggyTransactionDirection;
  kind: 'payment' | 'transfer' | 'refund' | 'expense' | 'income';
  transferType?: TransferType;
  installmentInfo?: InstallmentInfo;
  normalizedDescription: string;
};

const INSTALLMENT_PATTERN = /(parcela|parc|parcelado)\s*(\d+)\s*[\/-]\s*(\d+)/i;
const PAYMENT_PATTERN = /(pagamento\s+fatura|pagamento\s+cartao|pgto\s+fatura|fatura\s+cartao|bill\s+payment)/i;
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

function resolveDirection(transaction: PluggyTransaction): PluggyTransactionDirection {
  const type = transaction.type?.toLowerCase();
  if (type?.includes('credit')) return 'credit';
  if (type?.includes('debit')) return 'debit';

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

export function extractPluggyInstallmentInfo(transaction: PluggyTransaction): InstallmentInfo | undefined {
  const metadata = transaction.creditCardMetadata
    ? { number: transaction.creditCardMetadata.installmentNumber, total: transaction.creditCardMetadata.totalInstallments }
    : transaction.installment
      ?? transaction.installments;

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

export function isPluggyRefundCandidate(transaction: PluggyTransaction, direction?: PluggyTransactionDirection): boolean {
  const normalized = normalizeDescription(transaction.description);
  const inferredDirection = direction ?? resolveDirection(transaction);
  return inferredDirection === 'credit' && REFUND_PATTERN.test(normalized);
}

export function getPluggyTransferType(transaction: PluggyTransaction, direction?: PluggyTransactionDirection): TransferType | undefined {
  const normalized = normalizeDescription(transaction.description);
  const inferredDirection = direction ?? resolveDirection(transaction);
  const paymentMethod = transaction.paymentData?.paymentMethod?.toUpperCase();
  const operationType = transaction.operationType?.toUpperCase();

  if (PAYMENT_PATTERN.test(normalized)) {
    return 'fatura_payment';
  }

  if (paymentMethod && TRANSFER_METHODS.has(paymentMethod)) {
    return 'internal_transfer';
  }

  if (operationType && TRANSFER_METHODS.has(operationType)) {
    return 'internal_transfer';
  }

  if (operationType && DEPOSIT_TYPES.has(operationType) && inferredDirection === 'credit') {
    return 'deposit';
  }

  if (operationType && WITHDRAW_TYPES.has(operationType) && inferredDirection === 'debit') {
    return 'withdrawal';
  }

  if (DEPOSIT_PATTERN.test(normalized) && inferredDirection === 'credit') {
    return 'deposit';
  }

  if (WITHDRAW_PATTERN.test(normalized) && inferredDirection === 'debit') {
    return 'withdrawal';
  }

  if (TRANSFER_PATTERN.test(normalized)) {
    return 'internal_transfer';
  }

  return undefined;
}

export function classifyPluggyTransaction(transaction: PluggyTransaction): PluggyTransactionClassification {
  const direction = resolveDirection(transaction);
  const normalizedDescription = normalizeDescription(transaction.description);
  const transferType = getPluggyTransferType(transaction, direction);
  const installmentInfo = extractPluggyInstallmentInfo(transaction);

  if (isPluggyRefundCandidate(transaction, direction)) {
    return {
      direction,
      kind: 'refund',
      installmentInfo,
      normalizedDescription,
    };
  }

  if (transferType === 'fatura_payment') {
    return {
      direction,
      kind: 'payment',
      transferType,
      installmentInfo,
      normalizedDescription,
    };
  }

  if (transferType) {
    return {
      direction,
      kind: 'transfer',
      transferType,
      installmentInfo,
      normalizedDescription,
    };
  }

  return {
    direction,
    kind: direction === 'credit' ? 'income' : 'expense',
    installmentInfo,
    normalizedDescription,
  };
}
