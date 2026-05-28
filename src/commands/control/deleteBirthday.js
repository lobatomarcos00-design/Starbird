const { deleteEntryByUser } = require('../../utils/database');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('COMMAND:deletebirthday');

module.exports = {
  name: 'deletebirthday',
  description: 'Delete a user\'s stored birthday.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    if (args.length === 0) return message.channel.send('Usage: `!deletebirthday @user`');

    const targetArg = args[0];
    let targetUser;
    if (targetArg.startsWith('<@') && targetArg.endsWith('>')) {
      const id = targetArg.replace(/[<@!>]/g, '');
      targetUser = message.guild.members.cache.get(id)?.user;
    } else if (/^\d+$/.test(targetArg)) {
      targetUser = message.guild.members.cache.get(targetArg)?.user;
    }
    if (!targetUser) return message.channel.send('<:Negative:1508838218043363419> User not found.');

    try {
      const deleted = deleteEntryByUser('birthday', message.guild.id, targetUser.id);
      if (deleted) {
        await message.channel.send(`<:trashcan:1508838197373829131> Birthday of ${targetUser.tag} deleted.`);
      } else {
        await message.channel.send(`<:Negative:1508838218043363419> No birthday found for ${targetUser.tag}.`);
      }
    } catch (error) {
      logger.error('Deletebirthday failed:', error);
      await message.channel.send('<:Negative:1508838218043363419> Something went wrong.');
    }
  },
};