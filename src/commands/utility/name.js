// src/commands/utility/name.js
const { upsertEntry } = require('../../utils/database');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:name');

module.exports = {
  name: 'name',
  description: 'Store a real name for a user. Usage: !name @user Real Name',
  async execute(message, args) {
    if (args.length < 2) return message.channel.send('Usage: `!name @user Real Name`');

    // Resolve the target user
    const targetArg = args[0];
    let targetUser;
    if (targetArg.startsWith('<@') && targetArg.endsWith('>')) {
      const id = targetArg.replace(/[<@!>]/g, '');
      targetUser = message.guild.members.cache.get(id)?.user;
    } else if (/^\d+$/.test(targetArg)) {
      targetUser = message.guild.members.cache.get(targetArg)?.user;
    }
    if (!targetUser) return message.channel.send('<:Negative:1508838218043363419> User not found.');

    const realName = args.slice(1).join(' ').trim();
    if (!realName) return message.channel.send('<:Negative:1508838218043363419> Please provide a real name.');

    try {
      const result = upsertEntry('name', message.guild.id, targetUser.id, realName);
      const msg = result.created
        ? `<:Positive:1508838207838486579> Stored name for **${targetUser.tag}** → **${realName}**.`
        : `<:Positive:1508838207838486579> Updated name for **${targetUser.tag}** → **${realName}**.`;
      await message.channel.send(msg);
    } catch (error) {
      logger.error('Name command failed:', error);
      await message.channel.send('<:Negative:1508838218043363419> Something went wrong.');
    }
  },
};