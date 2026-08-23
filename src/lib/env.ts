/**
 * Runtime environment detection utilities.
 *
 * The same static build is deployed to both dev (dev.octavlearning.com,
 * d2c1g77zfmjpm3.cloudfront.net) and prod (octavlearning.com).  These helpers
 * use the hostname to tell them apart at runtime.
 */

const DEV_HOSTNAMES = new Set([
  'dev.octavlearning.com',
  'd2c1g77zfmjpm3.cloudfront.net',
  'localhost',
]);

/** True when the current hostname is a known dev environment. */
export function isDevEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return DEV_HOSTNAMES.has(window.location.hostname);
}