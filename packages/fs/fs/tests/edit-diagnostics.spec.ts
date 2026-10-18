/**
 * Unit tests for the anchor-mismatch diagnostics shared by the edit-capable
 * filesystem backends: fragment probing, line attribution, excerpt bounds,
 * and the no-fragment fallback.
 */
import { describe, expect, it } from 'vitest'
import { anchorMismatchDiagnostic, noFragmentNote } from '@deepseek-ai/dsh-fs'

describe('anchorMismatchDiagnostic', () => {
  it('locates the site of a surviving first-line fragment and quotes actual text', () => {
    const content = 'alpha\nconst target value = stale\ngamma\n'
    const out = anchorMismatchDiagnostic(content, 'const target value = fresh\nnext line')
    expect(out).toContain('closest anchor fragment at line 2')
    expect(out).toContain('const target value = stale')
  })

  it('probes shorter prefixes of a long first line', () => {
    const firstLine = 'x'.repeat(100) + ' drift-tail'
    const content = 'x'.repeat(100) + ' actual-tail\n'
    const out = anchorMismatchDiagnostic(content, firstLine)
    expect(out).toContain('closest anchor fragment at line 1')
  })

  it('catches tail drift on a short anchor via the longest surviving prefix', () => {
    const out = anchorMismatchDiagnostic('alpha\nbeta value = stale\ngamma\n', 'beta value = fresh')
    expect(out).toContain('closest anchor fragment at line 2')
    expect(out).toContain('beta value = stale')
  })

  it('returns an empty string when no fragment of the minimum length survives', () => {
    expect(anchorMismatchDiagnostic('a b c', 'completely different text here')).toBe('')
  })

  it('ignores probes shorter than minFragment', () => {
    expect(anchorMismatchDiagnostic('a b c', 'zz')).toBe('')
  })

  it('labels the excerpt as line-ending normalized by default', () => {
    const out = anchorMismatchDiagnostic('alpha\nconst target value = stale\ngamma\n', 'const target value = fresh')
    expect(out).toContain('— actual text (line endings normalized):')
  })

  it('drops the normalization claim for raw-text callers', () => {
    const out = anchorMismatchDiagnostic(
      'alpha\r\nconst target value = stale\r\ngamma\r\n',
      'const target value = fresh',
      12,
      { normalized: false },
    )
    expect(out).toContain('— actual text:')
    expect(out).not.toContain('(line endings normalized)')
  })
})

describe('noFragmentNote', () => {
  it('names the likely drift and the recovery', () => {
    expect(noFragmentNote()).toContain('no fragment of the anchor occurs in the file')
    expect(noFragmentNote()).toContain('re-read the target range')
  })
})
