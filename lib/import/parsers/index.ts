import { nubankParser } from './nubank';

export const parsers = {
  nubank: nubankParser,
  // Future: itau, bradesco, inter, etc.
} as const;

export type ParserKey = keyof typeof parsers;
export const parserList = Object.values(parsers);
