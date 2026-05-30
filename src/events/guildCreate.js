const { createLogger } = require('../utils/logger');
const { performServerSetup } = require('../utils/serverSetup');
const logger = createLogger('EVENT:guildCreate');

module.exports = {
  name: 'guildCreate',
  once: false,
  async execute(guild) {
    logger.info(`Joined new guild: ${guild.name}`);
    await performServerSetup(guild).catch(err => logger.error(`Setup failed in ${guild.name}: ${err}`));
  },
};