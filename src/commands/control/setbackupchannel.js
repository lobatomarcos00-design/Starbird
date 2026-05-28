const { createLogger } = require('../../utils/logger');
const config = require('../../utils/config');

const logger = createLogger('COMMAND:setbackupchannel');

module.exports = {
  name: 'setbackupchannel',
  description: 'Set the channel for daily database backups.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    const guildId = message.guild.id;
    const key = `backupChannel_${guildId}`;

    if (args.length === 0) {
      const currentId = config.get(key);
      if (currentId) {
        const channel = message.guild.channels.cache.get(currentId);
        return message.reply(`<:package:1508838121482096670> Backup channel is ${channel ? channel.toString() : 'missing'}.`);
      }
      return message.reply('<:package:1508838121482096670> No backup channel set.');
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

    if (!channel) return message.reply('<:Negative:1508838218043363419> Channel not found.');

    config.set(key, channel.id);
    await message.reply(`<:Positive:1508838207838486579> Backup channel set to ${channel}. Daily backups will be sent there.`);
  },
};