import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ContextView, Row } from '../types'

const BAR = 60
const BAR_W = 1000
const BAR_H = 8

const NAMED: Record<string, string> = {
  Messages: '#3b82f6',
  'System tools': '#f26b2d',
  'Memory files': '#12a594',
  Skills: '#d4a017',
  'System prompt': '#e5528a',
  'MCP tools': '#8b5cf6',
  'MCP server instructions': '#a78bfa',
  'Custom agents': '#22c55e',
}
const SPARE = ['#06b6d4', '#ef4444', '#84cc16', '#f472b6', '#eab308', '#6366f1']
const GREY = '#5f5f5f'
const FREE = '#2a2a2a'
const TRACK = '#2e2e2e'

const view = atom({ plugin: 'context-band', key: 'view' } as const, null, {
  shape: 'view-2',
})
const isOpen = atom({ plugin: 'context-band', key: 'isOpen' } as const, false)

function kilo(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}k`
  return `${n}`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Used rows largest first, then the buffer, free space and the deferred rows,
// as the desktop popover lists them.
function ordered(v: ContextView): Row[] {
  const by = (kind: Row['kind']) => v.rows.filter(r => r.kind === kind)
  const used = by('used').filter(r => r.tokens > 0).sort((a, b) => b.tokens - a.tokens)

  return [...used, ...by('buffer'), ...by('free'), ...by('deferred')]
}

function pct(r: Row, v: ContextView): string {
  return `${((r.tokens / Math.max(1, v.maxTokens)) * 100).toFixed(1)}%`
}

function hexColors(rows: Row[]): string[] {
  let spare = 0

  return rows.map(r => {
    if (r.kind === 'free') return FREE
    if (r.kind !== 'used') return GREY
    return NAMED[r.name] ?? SPARE[spare++ % SPARE.length] ?? GREY
  })
}

function barSvg(v: ContextView, rows: Row[], colors: string[]): string {
  const segs: string[] = []
  let x = 0

  rows.forEach((r, i) => {
    if (r.kind !== 'used' && r.kind !== 'buffer') return
    const w = (r.tokens / Math.max(1, v.maxTokens)) * BAR_W
    if (w <= 0 || x >= BAR_W) return
    const drawn = Math.max(3, Math.min(w, BAR_W - x))
    segs.push(
      `<rect class="seg" x="${x.toFixed(1)}" y="0" width="${Math.max(1.5, drawn - 2).toFixed(1)}" height="${BAR_H}" fill="${colors[i]}">` +
        `<title>${esc(r.name)}: ${kilo(r.tokens)} (${pct(r, v)})</title></rect>`,
    )
    x += drawn
  })

  const free = rows.find(r => r.kind === 'free')
  const freeTitle = free === undefined ? '' : `${esc(free.name)}: ${kilo(free.tokens)} (${pct(free, v)})`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${BAR_H}" viewBox="0 0 ${BAR_W} ${BAR_H}" preserveAspectRatio="none">` +
    `<style>.seg:hover{filter:brightness(1.3)}</style>` +
    `<defs><clipPath id="c"><rect width="${BAR_W}" height="${BAR_H}" rx="4"/></clipPath></defs>` +
    `<g clip-path="url(#c)"><rect width="${BAR_W}" height="${BAR_H}" fill="${TRACK}"><title>${freeTitle}</title></rect>${segs.join('')}</g>` +
    `</svg>`
  )
}

function swatchSvg(color: string, isFree: boolean): string {
  const stroke = isFree ? ' stroke="#4a4a4a" stroke-width="1"' : ''

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">` +
    `<rect x="0.5" y="0.5" width="11" height="11" rx="2.5" fill="${color}"${stroke}/></svg>`
  )
}

const CLOCK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">' +
  '<g fill="none" stroke="#bbbbbb" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="9" r="7.2"/><path d="M9 4.8V9l2.8 1.8"/></g></svg>'

async function measure($: EngineInterface): Promise<void> {
  const b = (await $.session.usage({ breakdown: 'summary' })).context.breakdown

  if (b === undefined) {
    return
  }

  const rows: Row[] = b.categories.map(c => ({
    name: c.name,
    tokens: c.tokens,
    color: c.color,
    kind: c.kind,
  }))
  const value: ContextView = {
    totalTokens: b.totalTokens,
    maxTokens: b.rawMaxTokens,
    percentage: b.percentage,
    rows,
  }
  await update($, view, () => value)
}

function textBar(v: ContextView): { color: string; text: string }[] {
  const out: { color: string; text: string }[] = []
  let left = BAR

  for (const r of ordered(v)) {
    if ((r.kind !== 'used' && r.kind !== 'buffer') || r.tokens <= 0) continue
    const n = Math.min(left, Math.max(1, Math.round((r.tokens / v.maxTokens) * BAR)))
    if (n === 0) break
    out.push({ color: r.kind === 'used' ? r.color : 'inactive', text: '█'.repeat(n) })
    left -= n
  }

  if (left > 0) {
    out.push({ color: 'subtle', text: '░'.repeat(left) })
  }

  return out
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await measure($)

    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      await measure($)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const v = await read($, view)

    if (e.props.hasSurvey || v === null) {
      return next(e)
    }

    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const open = await read($, isOpen)
    const total = `${kilo(v.totalTokens)} / ${kilo(v.maxTokens)} (${v.percentage}%)`
    const fold = (
      <Button
        key="fold"
        label={open ? '⌃' : '⌄'}
        onPress={() => update($, isOpen, was => !was)}
      />
    )

    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      const rows = ordered(v)
      const colors = hexColors(rows)

      return (
        <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX="md" paddingY="xs" gap="xs">
          <Box flexDirection="row" alignItems="center" gap="xs">
            <Svg source={CLOCK_SVG} alt="Context" width={18} height={18} />
            <Box flexGrow={1}>
              <Text>Context window</Text>
            </Box>
            <Text dimColor>{total}</Text>
            {fold}
          </Box>
          <Svg
            source={barSvg(v, rows, colors)}
            alt={`Context window ${total}`}
            height={BAR_H}
            isInteractive
          />
          {open && (
            <Box flexDirection="column">
              {rows.map((r, i) => (
                <Box
                  key={`row-${r.name}`}
                  flexDirection="row"
                  alignItems="center"
                  gap="sm"
                  paddingX="xs"
                  hover={{ backgroundColor: 'subtle' }}
                >
                  <Svg source={swatchSvg(colors[i] ?? GREY, r.kind === 'free')} alt="" width={12} height={12} />
                  <Box flexGrow={1}>
                    <Text size="footnote">{r.name}</Text>
                  </Box>
                  <Box width={9} justifyContent="flex-end">
                    <Text size="footnote" dimColor>{kilo(r.tokens)}</Text>
                  </Box>
                  <Box width={7} justifyContent="flex-end">
                    <Text size="footnote">{r.kind === 'deferred' ? '—' : pct(r, v)}</Text>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )
    }

    const pctColor = v.percentage >= 85 ? 'error' : v.percentage >= 65 ? 'warning' : 'text'

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" width={BAR}>
          <Box flexGrow={1}>
            <Text bold>Context window</Text>
          </Box>
          <Text color={pctColor}>{total} </Text>
          {fold}
        </Box>
        <Box flexDirection="row">
          {textBar(v).map((s, i) => (
            <Text key={`s${i}`} color={s.color}>
              {s.text}
            </Text>
          ))}
        </Box>
        {open &&
          ordered(v).map(r => (
            <Box key={r.name} flexDirection="row" width={BAR}>
              <Text color={r.kind === 'used' ? r.color : 'inactive'}>{'■ '}</Text>
              <Box flexGrow={1}>
                <Text dimColor={r.kind === 'deferred'}>{r.name}</Text>
              </Box>
              <Box width={10} justifyContent="flex-end">
                <Text dimColor>{kilo(r.tokens)}</Text>
              </Box>
              <Box width={8} justifyContent="flex-end">
                <Text>{r.kind === 'deferred' ? '-' : pct(r, v)}</Text>
              </Box>
            </Box>
          ))}
      </Box>
    )
  })
}
