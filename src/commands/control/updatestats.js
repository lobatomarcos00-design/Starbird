// src/commands/utility/updatestats.js
const { updateStatsEmbed } = require('../../utils/statsUpdater');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('COMMAND:updatestats');

module.exports = {
  name: 'updatestats',
  description: 'Manually updates the server statistics embed.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    logger.info(`Executed by ${message.author.tag} in ${message.guild.name}`);
    try {
      await updateStatsEmbed(message.guild);
      await message.channel.send('<:Positive:1508838207838486579> Statistics embed updated!');
    } catch (error) {
      logger.error('Failed to update stats:', error);
      await message.channel.send('<:Negative:1508838218043363419> Failed to update the statistics embed.');
    }
  },
};