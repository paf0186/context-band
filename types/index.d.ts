export type RowKind = 'used' | 'free' | 'buffer' | 'deferred'

export type Row = { name: string; tokens: number; color: string; kind: RowKind }

export type ContextView = {
  totalTokens: number
  maxTokens: number
  percentage: number
  rows: Row[]
}

declare module 'claude-code' {
  interface PluginState {
    'context-band': { view: Shaped<ContextView | null>; isOpen: boolean }
  }
}
