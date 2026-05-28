// src/commands/utility/setinvitelogchannel.js
const { createLogger } = require('../../utils/logger');
const config = require('../../utils/config');

const logger = createLogger('COMMAND:setinvitelogchannel');

module.exports = {
  name: 'setinvitelogchannel',
  description: 'Set the channel for invite join logs.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    const guildId = message.guild.id;
    const key = `inviteLogChannel_${guildId}`;

    if (args.length === 0) {
      const currentId = config.get(key);
      if (currentId) {
        const channel = message.guild.channels.cache.get(currentId);
        return message.channel.send(`📨 Invite log channel is ${channel ? channel.toString() : 'missing'}.`);
      }
      return message.channel.send('📨 No invite log channel set.');
    }

    const input = args[0];
    let channel;
    if (input.startsWith('<#') && input.endsWith('>')) {
      const id = input.replace(/[<#>]/g, '');
      channel = message.guild.channels.cache.get(id);
    } else if (/^\d+$/.test(input)) {
      channel = message.guild.channels.cache.get(input);
    } else {
      channel = message.guild.channels.cache.find(c => c.name === input && c.type === 0);
    }

    if (!channel) return message.channel.send('<:Negative:1508838218043363419> Channel not found.');

    config.set(key, channel.id);
    await message.channel.send(`<:Positive:1508838207838486579> Invite log channel set to ${channel}.`);
  },
};