/**
 * Simple logger that prefixes messages with a module name and timestamp.
 */
function createLogger(module) {
  const prefix = `[${module}]`;
  const time = () => new Date().toISOString();

  return {
    info: (...args) => console.log(`${prefix} ${time()}`, ...args),
    warn: (...args) => console.warn(`${prefix} ${time()}`, ...args),
    error: (...args) => console.error(`${prefix} ${time()}`, ...args),
  };
}

module.exports = { createLogger };