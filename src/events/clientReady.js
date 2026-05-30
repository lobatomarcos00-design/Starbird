// src/events/clientReady.js
const { scheduleDaily } = require('../utils/scheduler');
const { checkBirthdays } = require('../utils/birthdayChecker');
const { updateStatsEmbed, hourlyUpdateIfDirty } = require('../utils/statsUpdater');
const { fetchAndCache } = require('../utils/inviteCache');
const { recoverMutes, scheduleWarnReset } = require('../utils/moderation');
const { performServerSetup } = require('../utils/serverSetup');
const { createLogger } = require('../utils/logger');
const logger = createLogger('EVENT:clientReady');
const config = require('../utils/config');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`<:Positive:1508838207838486579> Logged in as ${client.user.tag}!`);
    // Set the bot's activity
    client.user.setActivity('Listening to !help', { type: ActivityType.Playing });

    // Run setup for any guild that hasn't been initialised yet
    for (const guild of client.guilds.cache.values()) {
      if (!config.get(`setupDone_${guild.id}`)) {
        logger.info(`Running initial setup for existing guild: ${guild.name}`);
        performServerSetup(guild).catch(err => logger.error(`Setup failed in ${guild.name}: ${err}`));
      }
    }

    // Initial invite cache for all guilds
    for (const guild of client.guilds.cache.values()) {
      fetchAndCache(guild).catch(err => logger.error(`Initial invite cache error in ${guild.name}:`, err));
    }

    const { recoverMutes, scheduleWarnReset } = require('../utils/moderation');

    // inside execute(client)
    recoverMutes(client);
    scheduleWarnReset(client);

    // Daily birthday check at 9:00 UTC
    scheduleDaily(9, 0, () => checkBirthdays(client));

    // Hourly update if dirty
    setInterval(async () => {
      logger.info('Running hourly stats update (if dirty)...');
      for (const guild of client.guilds.cache.values()) {
        await hourlyUpdateIfDirty(guild).catch(err => logger.error(`Stats error in ${guild.name}:`, err));
      }
    }, 3600_000);

    // Initial stats update after 10 seconds
    setTimeout(() => {
      logger.info('Running initial stats update...');
      for (const guild of client.guilds.cache.values()) {
        updateStatsEmbed(guild).catch(err => logger.error(`Initial stats update error in ${guild.name}:`, err));
      }
    }, 10_000);
  },
};