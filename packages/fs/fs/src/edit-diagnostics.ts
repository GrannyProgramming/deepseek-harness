/**
 * Anchor-mismatch diagnostics for literal edit failures. A bare
 * "old_string was not found" forces the model to re-read the whole file and
 * guess at the drift; this helper locates the closest surviving fragment of
 * the anchor and quotes the file's actual text at that site, so one error
 * result usually carries enough context to retry correctly (retro #103, F05).
 * @module @deepseek-ai/dsh-fs/src/edit-diagnostics
 */

/** Cap on the first/last-line probe length; anchors longer than this probe by head only. */
const PROBE_CAP = 200

/**
 * Longest prefix of `line` that still occurs in `content`, or null when no
 * prefix of at least `min` characters survives. Lengths are probed downward
 * one character at a time from the capped head, so tail drift on short anchors
 * is caught too.
 */
function longestPrefixProbe(content: string, line: string, min: number): string | null {
  const head = line.slice(0, Math.min(line.length, PROBE_CAP))
  for (let len = head.length; len >= min; len -= 1) {
    const probe = head.slice(0, len)
    if (content.includes(probe)) return probe
  }
  return null
}

/**
 * Build the anchor-mismatch suffix for an `FS_EDIT_NOT_FOUND` message.
 * Probes the full anchor, then the longest surviving prefixes of its first
 * and last lines, and at the first hit quotes the file's actual lines around
 * that site. Both inputs are treated as LF-normalized; the excerpt is
 * normalized the same way. A caller that matches over raw (un-normalized)
 * file text passes `{ normalized: false }` so the suffix does not claim a
 * normalization it did not perform. Returns an empty string only when no
 * fragment of at least `minFragment` characters survives; the caller then
 * appends the no-fragment note via {@link noFragmentNote}.
 *
 * @param content - the current file content, LF-normalized.
 * @param oldString - the anchor that failed to match, LF-normalized.
 * @param minFragment - the shortest probe length (default 12).
 * @param options - `normalized` (default true): whether `content` and `oldString`
 * are LF-normalized; false labels the excerpt plain `actual text`.
 * @returns a suffix beginning with `; closest anchor fragment ...` or an empty string.
 */
export function anchorMismatchDiagnostic(
  content: string,
  oldString: string,
  minFragment = 12,
  options: { normalized?: boolean } = {},
): string {
  const lines = oldString.split('\n')
  const firstLine = lines[0] ?? ''
  const lastLine = lines[lines.length - 1] ?? ''
  const probe = content.includes(oldString) ? oldString
    : longestPrefixProbe(content, firstLine, minFragment)
      ?? longestPrefixProbe(content, lastLine, minFragment)
  if (probe === null) return ''
  const index = content.indexOf(probe)
  const line = content.slice(0, index).split('\n').length
  const excerptEnd = Math.min(line + lines.length + 1, line + 9)
  const excerpt = content.split('\n').slice(line - 1, excerptEnd).join('\n').slice(0, 400)
  const actualText = options.normalized === false ? 'actual text' : 'actual text (line endings normalized)'
  return `; closest anchor fragment at line ${line} — ${actualText}:\n${excerpt}`
}

/**
 * The fallback note when no fragment of the anchor survives in the file.
 * @returns the suffix explaining the likely drift.
 */
export function noFragmentNote(): string {
  return '; no fragment of the anchor occurs in the file — it may be paraphrased or from a different version; re-read the target range before retrying'
}
