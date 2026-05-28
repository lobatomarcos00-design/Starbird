// src/commands/utility/settings.js
const config = require('../../utils/config');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:settings');

module.exports = {
  name: 'settings',
  description: 'Show the current server configuration.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    const guild = message.guild;
    const guildId = guild.id;

    const channelDisplay = (id) => {
      if (!id) return '<:Negative:1508838218043363419> Not set';
      const channel = guild.channels.cache.get(id);
      return channel ? `${channel.toString()} (${channel.name})` : '<:Negative:1508838218043363419> Not set (deleted)';
    };
    const roleDisplay = (id) => {
      if (!id) return '<:Negative:1508838218043363419> Not set';
      const role = guild.roles.cache.get(id);
      return role ? `${role.toString()} (${role.name})` : '<:Negative:1508838218043363419> Not set (deleted)';
    };

    const embed = {
      color: 0x215db1,  // main color
      title: '<:package:1508838121482096670> Server Configuration',
      fields: [
        {
          name: 'Welcome Channel',
          value: channelDisplay(config.get(`welcomeChannel_${guildId}`)),
          inline: false,
        },
        {
          name: 'Voice Log Channel',
          value: channelDisplay(config.get(`voiceLogChannel_${guildId}`)),
          inline: false,
        },
        {
          name: 'Birthday Channel',
          value: channelDisplay(config.get(`birthdayChannel_${guildId}`)),
          inline: false,
        },
        {
          name: 'Backup Channel',
          value: channelDisplay(config.get(`backupChannel_${guildId}`)),
          inline: false,
        },
        {
          name: 'Invite Log Channel',
          value: channelDisplay(config.get(`inviteLogChannel_${guildId}`)),
          inline: false,
        },
        {
          name: 'Default Role',
          value: roleDisplay(config.get(`defaultRole_${guildId}`)),
          inline: false,
        },
        {
          name: 'Voice Min Duration',
          value: `${config.get(`voiceMinDuration_${guildId}`) || 30} minutes`,
          inline: false,
        },
        {
          name: 'Statistics Channel',
          value: channelDisplay(config.get(`statsChannel_${guildId}`)),
          inline: false,
        },
      ],
      footer: { text: 'Use !help to see setup commands' },
    };

    await message.channel.send({ embeds: [embed] });
  },
};