const { getEntriesByKey } = require('./database');
const config = require('./config');
const { createLogger } = require('./logger');
const logger = createLogger('BIRTHDAY_CHECK');

async function checkBirthdays(client) {
  logger.info('Running daily birthday check...');
  for (const guild of client.guilds.cache.values()) {
    try {
      const channelId = config.get(`birthdayChannel_${guild.id}`);
      if (!channelId) continue;

      const channel = guild.channels.cache.get(channelId);
      if (!channel) continue;

      const entries = getEntriesByKey('birthday', guild.id);
      if (entries.length === 0) continue;

      const today = new Date();
      const todayUTC = {
        day: today.getUTCDate(),
        month: today.getUTCMonth() + 1,
      };

      for (const entry of entries) {
        const parts = entry.value.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parts.length === 3 ? parseInt(parts[2], 10) : null;

        if (day === todayUTC.day && month === todayUTC.month) {
          const user = await client.users.fetch(entry.userid).catch(() => null);
          if (!user) continue;

          if (year) {
            const age = today.getUTCFullYear() - year;
            await channel.send(
              `<:cake:1508838162401857718> **Happy Birthday, ${user}!** <:star:1508838174305030306>\nYou are **${age} years old** today!\nhttps://imgur.com/a/birthday-2-I9xtMih`
            );
          } else {
            await channel.send(
              `<:cake:1508838162401857718> **Happy Birthday, ${user}!** <:star:1508838174305030306>\nhttps://imgur.com/a/birthday-2-I9xtMih`
            );
          }
        }
      }
    } catch (error) {
      logger.error(`Error checking birthdays for ${guild.name}:`, error);
    }
  }
}

module.exports = { checkBirthdays };