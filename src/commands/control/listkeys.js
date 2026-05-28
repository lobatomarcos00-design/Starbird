const { getEntriesByKeyPrefix } = require('../../utils/database');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('COMMAND:listkeys');

module.exports = {
  name: 'listkeys',
  description: 'Show all keys in this server with their latest value.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    logger.info(`Executed by ${message.author.tag} in ${message.guild.name}`);
    try {
      const prefix = 'store_';
      const entries = getEntriesByKeyPrefix(prefix, message.guild.id);
      if (entries.length === 0) return message.channel.send('📭 No stored data.');

      // Group by the numeric part of the key
      const grouped = {};
      for (const e of entries) {
        const keyNum = e.key.slice(prefix.length);
        if (!grouped[keyNum]) grouped[keyNum] = [];
        grouped[keyNum].push(e);
      }

      const lines = [];
      for (const [num, list] of Object.entries(grouped)) {
        const latest = list.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        lines.push(`<:folder:1508838186095481053> \`${num}\` – ${list.length} entries | Latest: ${latest.value} (${new Date(latest.date).toLocaleDateString()})`);
      }

      const response = `<:folder:1508838186095481053> **Keys in this server:**\n` + lines.join('\n');
      if (response.length > 2000) {
        return message.channel.send('Too many keys to display.');
      }
      await message.channel.send(response);
    } catch (error) {
      logger.error('Listkeys failed:', error);
      await message.channel.send('<:Negative:1508838218043363419> Something went wrong.');
    }
  },
};