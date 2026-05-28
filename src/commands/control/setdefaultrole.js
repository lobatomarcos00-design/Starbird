// src/commands/utility/setdefaultrole.js
const { PermissionsBitField } = require('discord.js');
const config = require('../../utils/config');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:setdefaultrole');

module.exports = {
  name: 'setdefaultrole',
  description: 'Set a role to be automatically assigned to new members. Creates it if missing.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    const guild = message.guild;
    const botMember = guild.members.me;
    if (!botMember.permissions.has('ManageRoles')) {
      return message.channel.send('<:Negative:1508838218043363419> I need **Manage Roles** permission.');
    }

    if (args.length === 0) {
      const currentId = config.get(`defaultRole_${guild.id}`);
      if (currentId) {
        const role = guild.roles.cache.get(currentId);
        return message.channel.send(`📌 Default role is ${role ? role.toString() : 'deleted'}.`);
      }
      return message.channel.send('📌 No default role set. Usage: `!setdefaultrole <name or mention>`');
    }

    const input = args.join(' ').trim();
    let role = guild.roles.cache.find(r => r.name === input || r.id === input || r.toString() === input);
    if (role) {
      config.set(`defaultRole_${guild.id}`, role.id);
      logger.info(`Default role set to existing ${role.name} (${role.id}) in ${guild.name}`);
      return message.channel.send(`<:Positive:1508838207838486579> Default role set to ${role.toString()}.`);
    }

    // Create role with main color
    try {
      role = await guild.roles.create({
        name: input,
        color: '215db1',   // main color
        hoist: true,
        permissions: [],
        reason: 'Default role for new members',
      });
      logger.info(`Created role ${role.name} (${role.id}) for default role.`);
      try {
        await role.setPosition(1);
        logger.info(`Position set to 1 for default role.`);
      } catch (posErr) {
        logger.warn(`Could not set position of default role: ${posErr.message}`);
      }
      config.set(`defaultRole_${guild.id}`, role.id);
      await message.channel.send(`<:Positive:1508838207838486579> Created role **${role.name}** and set it as default for new members.`);
    } catch (error) {
      logger.error('Failed to create default role:', error);
      await message.channel.send('<:Negative:1508838218043363419> Could not create role. Check my permissions.');
    }
  },
};