// ExtendScript è ES3: queste funzioni ES5 le aggiunge lib/es5.jsx in testa a ogni script.

interface Array<T> {
  forEach(fn: (value: T, index: number, array: T[]) => void): void
  map<U>(fn: (value: T, index: number, array: T[]) => U): U[]
  filter(fn: (value: T, index: number, array: T[]) => boolean): T[]
  some(fn: (value: T, index: number, array: T[]) => boolean): boolean
  every(fn: (value: T, index: number, array: T[]) => boolean): boolean
  reduce<U>(fn: (acc: U, value: T, index: number, array: T[]) => U, initial: U): U
  indexOf(value: T, fromIndex?: number): number
}

interface ArrayConstructor {
  isArray(value: any): value is any[]
}

interface String {
  trim(): string
}

interface ObjectConstructor {
  keys(o: object): string[]
}

interface JSON {
  stringify(value: any): string
  parse(text: string): any
}
declare var JSON: JSON
