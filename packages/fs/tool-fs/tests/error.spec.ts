/**
 * Unit tests for model-facing guarded-mutation diagnostics: normalized unread
 * failures, the stale-version remedy, code preservation, and passthrough.
 */

import { describe, expect, it } from 'vitest'
import { FsError } from '@deepseek-ai/dsh-fs'
import { remediateFsError } from '../src/error.ts'

describe('remediateFsError', () => {
  it('appends the re-read remedy to FS_STALE_VERSION, preserving the code and chaining the cause', () => {
    const original = new FsError('cannot edit "x": file changed since it was read', 'FS_STALE_VERSION')
    const remedied = remediateFsError(original, 'x') as FsError
    expect(remedied).toBeInstanceOf(FsError)
    expect(remedied.message).toBe('cannot edit "x": file changed since it was read — re-read the file, then retry')
    expect(remedied.code).toBe('FS_STALE_VERSION')
    expect(remedied.cause).toBe(original)
  })

  it('normalizes policy and provider FS_NOT_OBSERVED failures to one diagnostic', () => {
    const sources = [
      new FsError('edit requires reading "x" first', 'FS_NOT_OBSERVED'),
      new FsError('cannot overwrite existing "x" without reading it first', 'FS_NOT_OBSERVED'),
    ]
    const remedied = sources.map(error => remediateFsError(error, 'x') as FsError)
    expect(remedied.map(error => error.message)).toEqual([
      'cannot modify "x": file has not been read — read the file, then retry',
      'cannot modify "x": file has not been read — read the file, then retry',
    ])
    expect(remedied.map(error => error.code)).toEqual(['FS_NOT_OBSERVED', 'FS_NOT_OBSERVED'])
    expect(remedied.map(error => error.cause)).toEqual(sources)
  })

  it('appends the actual-text remedy to FS_EDIT_NOT_FOUND', () => {
    const remedied = remediateFsError(new FsError('old_string was not found in "x"', 'FS_EDIT_NOT_FOUND'), 'x') as FsError
    expect(remedied.message).toBe('old_string was not found in "x" — retry with the actual text quoted in the error, or re-read the exact target range first — never guess an approximation of text you have not re-read')
    expect(remedied.code).toBe('FS_EDIT_NOT_FOUND')
  })

  it('appends the specificity remedy to FS_AMBIGUOUS_EDIT', () => {
    const remedied = remediateFsError(new FsError('old_string matched 3 times in "x"', 'FS_AMBIGUOUS_EDIT'), 'x') as FsError
    expect(remedied.message).toBe('old_string matched 3 times in "x" — provide a more specific old_string spanning more surrounding context, or set replace_all to true')
    expect(remedied.code).toBe('FS_AMBIGUOUS_EDIT')
  })

  it('leaves other FsError codes untouched', () => {
    const original = new FsError('no such node', 'FS_NOT_FOUND')
    expect(remediateFsError(original, 'x')).toBe(original)
  })

  it('leaves non-FsError values untouched', () => {
    const original = new Error('boom')
    expect(remediateFsError(original, 'x')).toBe(original)
  })
})
