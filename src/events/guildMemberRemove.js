const { PermissionsBitField } = require('discord.js');
const config = require('../utils/config');
const { createLogger } = require('../utils/logger');
const logger = createLogger('EVENT:guildMemberRemove');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(member) {
    // Ignore bots
    if (member.user.bot) return;

    const guild = member.guild;
    if (!guild.available || !guild.members.me) return;

    const channelId = config.get(`welcomeChannel_${guild.id}`);
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const botPermissions = channel.permissionsFor(guild.members.me);
    if (!botPermissions.has(PermissionsBitField.Flags.SendMessages)) {
      logger.warn(`[${guild.name}] Cannot send goodbye message – missing permissions.`);
      return;
    }

    try {
      await channel.send(`<:Negative:1508838218043363419> ${member.user.username} has left the server. We'll miss you!`);
    } catch (error) {
      logger.error(`[${guild.name}] Failed to send goodbye message:`, error);
    }
  },
};