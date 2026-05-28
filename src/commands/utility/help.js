// src/commands/utility/help.js
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:help');

// Maximum characters per DM message (Discord limit is 2000)
const MAX_CHARS = 2000;

module.exports = {
  name: 'help',
  description: 'Sends you the full command list via DM.',
  async execute(message, args) {
    const isAdmin = message.member.permissions.has('ManageGuild');
    const commands = message.client.commands;

    // Separate commands
    const publicCmds = [];
    const adminCmds = [];
    for (const [name, cmd] of commands) {
      const isAdminCmd = cmd.requiredPermissions && cmd.requiredPermissions.length > 0;
      if (isAdminCmd) {
        adminCmds.push(`!${name} – ${cmd.description || 'No description'}`);
      } else {
        publicCmds.push(`!${name} – ${cmd.description || 'No description'}`);
      }
    }

    // Build the full content
    let content = '';
    if (publicCmds.length > 0) {
      content += '**Everyone Commands**\n';
      content += publicCmds.join('\n');
    }
    if (adminCmds.length > 0 && isAdmin) {
      if (publicCmds.length > 0) content += '\n\n';
      content += '**Admin Commands**\n';
      content += adminCmds.join('\n');
    }
    if (!content) content = 'No commands available.';

    // Split into chunks if necessary
    const chunks = [];
    while (content.length > 0) {
      if (content.length <= MAX_CHARS) {
        chunks.push(content);
        break;
      }
      // Find a good split point (newline)
      let splitAt = content.lastIndexOf('\n', MAX_CHARS);
      if (splitAt === -1 || splitAt < MAX_CHARS / 2) {
        splitAt = MAX_CHARS; // force split mid-word if no newline found
      }
      chunks.push(content.slice(0, splitAt));
      content = content.slice(splitAt).trimStart();
    }

    // Try to send DMs
    try {
      for (const chunk of chunks) {
        await message.author.send(chunk);
      }
      // Confirm in server
      await message.channel.send(
        `<:Positive:1508838207838486579> ${message.author.username}, I've sent you a DM with the command list.`
      );
    } catch (err) {
      logger.warn(`Could not DM help to ${message.author.tag}: ${err.message}`);
      await message.channel.send(
        '❌ I could not send you a DM. Please make sure your DMs are open and try again.'
      );
    }
  },
};