/**
 * Model-facing diagnostics for guarded-mutation failures. Providers and
 * policies retain operation-specific causes, while this package owns the
 * stable message shown to the model: staleness/observation failures are
 * normalized here, and the literal-match failures (`FS_EDIT_NOT_FOUND`,
 * `FS_AMBIGUOUS_EDIT`) state the condition but not the recovery, so their
 * remedy is appended at the same boundary; provider messages stay
 * machine-oriented and unchanged.
 * @module @deepseek-ai/dsh-tool-fs/src/error
 */

import { FsError } from '@deepseek-ai/dsh-fs'
import type { FsErrorCode } from '@deepseek-ai/dsh-fs'

/** The remedy appended to each literal-match failure code's message. */
const REMEDIES: Partial<Record<FsErrorCode, string>> = {
  FS_EDIT_NOT_FOUND: 'retry with the actual text quoted in the error, or re-read the exact target range first — never guess an approximation of text you have not re-read',
  FS_AMBIGUOUS_EDIT: 'provide a more specific old_string spanning more surrounding context, or set replace_all to true',
}

/**
 * Render the stable model-facing diagnostic for a guarded-mutation failure.
 * `FS_STALE_VERSION` keeps the provider's reason and appends its re-read
 * remedy. `FS_NOT_OBSERVED` replaces operation-specific policy/provider text
 * with one path-aware reason and read remedy. The literal-match failures keep
 * the provider's anchor-mismatch context and append their retry remedy. The
 * original error remains the cause, and every diagnostic preserves its code
 * for machine routing. Anything else passes through untouched.
 * @param error - the caught value from a write/edit execution.
 * @param displayPath - the resolved target path shown to the model.
 * @returns a remediated `FsError` for the remediable codes, else the original value.
 */
export function remediateFsError(error: unknown, displayPath: string): unknown {
  if (!(error instanceof FsError)) return error
  if (error.code === 'FS_NOT_OBSERVED') {
    return new FsError(
      `cannot modify "${displayPath}": file has not been read — read the file, then retry`,
      error.code,
      { cause: error },
    )
  }
  if (error.code === 'FS_STALE_VERSION') {
    return new FsError(`${error.message} — re-read the file, then retry`, error.code, { cause: error })
  }
  const remedy = REMEDIES[error.code]
  if (remedy !== undefined) {
    return new FsError(`${error.message} — ${remedy}`, error.code, { cause: error })
  }
  return error
}
