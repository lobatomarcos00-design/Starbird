// src/events/messageCreate.js
const { PermissionsBitField } = require('discord.js');
const { createLogger } = require('../utils/logger');
const { incrementEntry } = require('../utils/database');
const { moderateMessage } = require('../utils/moderation');
const logger = createLogger('EVENT:messageCreate');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    // Track message count
    try {
      incrementEntry(`msg_${message.guild.id}`, message.guild.id, message.author.id, 1);
      // In messageCreate.js, after incrementEntry(`msg_${message.guild.id}`...)
      const { addMessage, conditionalUpdate } = require('../utils/statsUpdater');
      if (addMessage(message.guild.id)) {
        conditionalUpdate(message.guild).catch(() => { });
      }
    } catch (err) {
      logger.error('Failed to increment msg count:', err);
    }

    // Moderation check (deletes the message if it's an offense)
    if (await moderateMessage(message)) return;

    // Command handling
    const prefix = process.env.PREFIX || '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = message.client.commands.get(commandName);
    if (!command) return;

    if (command.requiredPermissions && Array.isArray(command.requiredPermissions)) {
      const missing = command.requiredPermissions.filter(perm => !message.member.permissions.has(perm));
      if (missing.length > 0) {
        logger.warn(`User missing permissions: ${missing.join(', ')}`);
        return message.channel.send(`You lack the required **permissions** to used that command **${message.member.displayName}**.`);
      }
    }

    try {
      await command.execute(message, args);
    } catch (error) {
      logger.error(`Error executing "${commandName}":`, error);
      await message.channel.send('<:Negative:1508838218043363419> There was an error executing that command!');
    }
  },
};