const { createLogger } = require('./logger');
const logger = createLogger('SCHEDULER');

function scheduleDaily(hour, minute, task) {
  const now = new Date();
  let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  const delay = next.getTime() - now.getTime();
  logger.info(`Scheduling daily task at ${hour}:${minute} UTC. First run in ${(delay / 1000 / 60).toFixed(1)} minutes.`);

  const runAndReschedule = async () => {
    try {
      await task();
    } catch (error) {
      logger.error('Scheduled task error:', error);
    }
    const nextDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate() + 1, hour, minute, 0, 0));
    const nextDelay = nextDay.getTime() - Date.now();
    setTimeout(runAndReschedule, nextDelay);
    logger.info(`Next run scheduled at ${nextDay.toISOString()}`);
  };

  setTimeout(runAndReschedule, delay);
}

module.exports = { scheduleDaily };