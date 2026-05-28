const { createLogger } = require('../../utils/logger');
const config = require('../../utils/config');

const logger = createLogger('COMMAND:setvoicemin');

module.exports = {
  name: 'setvoicemin',
  description: 'Set the minimum voice call duration (minutes) for logs.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    const guildId = message.guild.id;
    const key = `voiceMinDuration_${guildId}`;

    logger.info(`Executed by ${message.author.tag} in ${message.guild.name}`);

    if (args.length === 0) {
      const current = config.get(key) || 30;
      return message.channel.send(`📏 Current minimum voice log duration: **${current} minutes**.`);
    }

    const minutes = parseInt(args[0], 10);
    if (isNaN(minutes) || minutes < 1) {
      return message.channel.send('<:Negative:1508838218043363419> Please provide a valid positive number of minutes.');
    }

    config.set(key, minutes);
    await message.channel.send(`<:Positive:1508838207838486579> Voice log threshold set to **${minutes} minutes**.`);
  },
};