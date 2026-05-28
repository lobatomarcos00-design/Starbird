const { resetAllWarnsAndMutes } = require('../../utils/moderation');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:resetwarns');

module.exports = {
  name: 'resetwarns',
  description: 'Reset all warns and clear all active mutes.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    await resetAllWarnsAndMutes(message.guild);
    logger.info(`Warns and mutes cleared in ${message.guild.name} by ${message.author.tag}`);
    await message.channel.send('<:Positive:1508838207838486579> All warns cleared and muted users have been restored.');
  },
};