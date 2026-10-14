/**
 * Zero-telemetry logger.
 * - In PRODUCTION: all log/info/debug calls are silent no-ops.
 * - In DEVELOPMENT: output appears normally in the browser console.
 *
 * Usage:
 *   import log from "@/src/utils/logger";
 *   log.info('User found:', user.id);   // silent in prod
 *   log.error('Failed:', err);           // ALWAYS shown (even in prod)
 */

const isProd = import.meta.env.PROD;
const noop = (..._args: any[]) => { };

const log = {
    log: isProd ? noop : console.log.bind(console),
    info: isProd ? noop : console.info.bind(console),
    debug: isProd ? noop : console.debug.bind(console),
    warn: isProd ? noop : console.warn.bind(console),
    // error always shows — it's for real failures, not diagnostics
    error: console.error.bind(console),
};

export default log;



