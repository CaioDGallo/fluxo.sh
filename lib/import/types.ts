export type ValidatedImportRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number;
  rowIndex: number;
};

export type ImportRowError = {
  rowIndex: number;
  field: 'date' | 'description' | 'amount';
  message: string;
  rawValue: string;
};

export type ParseResult = {
  rows: ValidatedImportRow[];
  errors: ImportRowError[];
  skipped: number;
};

export type ImportTemplate = {
  id: string;
  name: string;
  description: string;
  parse: (content: string) => ParseResult;
};
