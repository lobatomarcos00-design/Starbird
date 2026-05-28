// src/commands/control/purge.js
const { PermissionsBitField } = require('discord.js');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:purge');

module.exports = {
  name: 'purge',
  description: 'Delete a number of recent messages (max 1000).',
  requiredPermissions: ['ManageMessages'],
  async execute(message, args) {
    if (!message.guild.members.me.permissions.has('ManageMessages')) {
      return message.channel.send('<:Negative:1508838218043363419> I need **Manage Messages** permission.');
    }

    const amount = parseInt(args[0], 10);
    if (isNaN(amount) || amount < 1 || amount > 1000) {
      return message.channel.send('<:Negative:1508838218043363419> Please provide a number between 1 and 1000.');
    }

    // Delete the command message first (so it doesn't count in the purge)
    await message.delete().catch(() => {});

    let deletedTotal = 0;
    let remaining = amount;

    // Loop to delete messages in batches of up to 100
    while (remaining > 0) {
      const batchSize = Math.min(remaining, 100);

      const messages = await message.channel.messages.fetch({ limit: batchSize });
      if (messages.size === 0) break;

      // Filter out messages older than 14 days (bulk delete limitation)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const deleteable = messages.filter(m => m.createdTimestamp > twoWeeksAgo);

      if (deleteable.size > 0) {
        const deleted = await message.channel.bulkDelete(deleteable, true);
        deletedTotal += deleted.size;
        remaining -= deleted.size;
      } else {
        // No deletable messages left in this batch → stop
        break;
      }

      // If fewer messages were fetched than requested, we've reached the end
      if (messages.size < 100) break;

      // Short delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Send confirmation that stays in the channel
    await message.channel.send(`<:broom:1508838152406696006> Purge was used, ${deletedTotal} messages were deleted.`);
    logger.info(`Purged ${deletedTotal} messages in ${message.guild.name} by ${message.author.tag}`);
  },
};