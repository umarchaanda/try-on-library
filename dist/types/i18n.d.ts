import type { Locale, StringKey } from './types';
type Dict = Record<StringKey, string>;
export declare function makeT(locale: Locale, overrides?: Partial<Dict>): (key: StringKey) => string;
export {};
