const { getEntriesByKey } = require('../../utils/database');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('COMMAND:get');

module.exports = {
  name: 'get',
  description: 'Get all entries for a key in this server.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    logger.info(`Executed by ${message.author.tag} in ${message.guild.name}`);
    if (args.length === 0) return message.channel.send('Usage: `!get <key>`');

    const keyNum = args[0];
    const key = `store_${keyNum}`;
    const entries = getEntriesByKey(key, message.guild.id);
    if (entries.length === 0) return message.channel.send(`No data for key \`${keyNum}\`.`);

    const response = entries.map((e, i) =>
      `**${i + 1}.** <@${e.userid}>, Value: \`${e.value}\`, Size: ${e.size}, Date: ${new Date(e.date).toLocaleString()}`
    ).join('\n');

    if (response.length > 2000) {
      return message.channel.send('Too many entries to display.');
    }
    await message.channel.send(`<:folder:1508838186095481053> Entries for **${keyNum}**:\n${response}`);
  },
};