export type RowKind = 'used' | 'free' | 'buffer' | 'deferred'

export type Row = { name: string; tokens: number; color: string; kind: RowKind }

export type ContextView = {
  totalTokens: number
  maxTokens: number
  percentage: number
  rows: Row[]
  startedAt: number
  measuredAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'context-band': { view: Shaped<ContextView | null>; isOpen: boolean; now: number; lastTurnEnd: number }
  }
}
