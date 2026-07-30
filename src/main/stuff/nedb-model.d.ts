declare module 'nedb/lib/model' {
  export function deserialize(rawData: string): Record<string, unknown>
  export function serialize(document: Record<string, unknown>): string
}
