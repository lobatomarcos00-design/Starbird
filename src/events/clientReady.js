// src/events/clientReady.js
const { scheduleDaily } = require('../utils/scheduler');
const { checkBirthdays } = require('../utils/birthdayChecker');
const { updateStatsEmbed } = require('../utils/statsUpdater');
const { fetchAndCache } = require('../utils/inviteCache');
const { createLogger } = require('../utils/logger');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const logger = createLogger('EVENT:clientReady');

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`<:Positive:1508838207838486579> Logged in as ${client.user.tag}!`);
    // Set the bot's activity
    client.user.setActivity('Endwalker', { type: ActivityType.Playing });

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

    // Stats update every 30 minutes
    setInterval(async () => {
      logger.info('Running regular stats update...');
      for (const guild of client.guilds.cache.values()) {
        await updateStatsEmbed(guild).catch(err => logger.error(`Stats update error in ${guild.name}:`, err));
      }
    }, 1800_000); // 30 minutes

    // Initial stats update after 10 seconds
    setTimeout(() => {
      logger.info('Running initial stats update...');
      for (const guild of client.guilds.cache.values()) {
        updateStatsEmbed(guild).catch(err => logger.error(`Initial stats update error in ${guild.name}:`, err));
      }
    }, 10_000);
  },
};