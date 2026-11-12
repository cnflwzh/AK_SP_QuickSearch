/** Returns an empty anchor for malformed external fragments instead of aborting page startup. */
export function decodeFragment(hash: string): string {
  try { return decodeURIComponent(hash.replace(/^#/, '')); } catch { return ''; }
}
