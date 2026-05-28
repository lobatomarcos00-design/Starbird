const { PermissionsBitField } = require('discord.js');
const config = require('../../utils/config');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('COMMAND:setupstats');

/**
 * Deletes all messages in a text channel (handles bulk delete limits).
 */
async function clearChannel(channel) {
  if (!channel.manageable) return;
  let messages;
  do {
    messages = await channel.messages.fetch({ limit: 100 });
    if (messages.size > 0) {
      await channel.bulkDelete(messages, true).catch(() => { });
    }
  } while (messages.size >= 100);
}

module.exports = {
  name: 'setupstats',
  description: 'Create/reset the server statistics channel and embed.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    const guild = message.guild;
    const botMember = guild.members.me;
    if (!botMember.permissions.has('ManageChannels')) {
      return message.channel.send('<:Negative:1508838218043363419> I need **Manage Channels** permission.');
    }

    try {
      // Try to find the existing stats channel (by config or by name)
      const channelId = config.get(`statsChannel_${guild.id}`);
      let statsChannel = channelId ? guild.channels.cache.get(channelId) : null;
      if (!statsChannel) {
        statsChannel = guild.channels.cache.find(c => c.name === '📊-statistics' && c.type === 0);
      }

      if (statsChannel) {
        // Channel exists – clear it
        await clearChannel(statsChannel);
        logger.info(`Cleared messages in existing stats channel.`);
      } else {
        // Create new channel
        statsChannel = await guild.channels.create({
          name: '📊-statistics',
          type: 0,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.SendMessages] },
          ],
          reason: 'Server statistics',
        });
        logger.info(`Created new stats channel.`);
      }

      // Post new embed
      const embed = {
        color: 0x1abc9c,
        title: '📊 Server Statistics',
        description: 'No data yet.',
        footer: { text: `Last updated: ${new Date().toLocaleString()}` },
      };
      const msg = await statsChannel.send({ embeds: [embed] });

      config.set(`statsChannel_${guild.id}`, statsChannel.id);
      config.set(`statsMessage_${guild.id}`, msg.id);

      await message.channel.send(`<:Positive:1508838207838486579> Statistics channel ready: ${statsChannel}`);
    } catch (error) {
      logger.error('Setupstats failed:', error);
      await message.channel.send('<:Negative:1508838218043363419> Something went wrong.');
    }
  },
};