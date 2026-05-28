// src/events/inviteCreate.js
const { cacheInvite } = require('../utils/inviteCache');
const { createLogger } = require('../utils/logger');
const logger = createLogger('EVENT:inviteCreate');

module.exports = {
  name: 'inviteCreate',
  once: false,
  async execute(invite) {
    cacheInvite(invite.guild.id, invite.code, invite.inviter.id, invite.uses);
    logger.info(`[${invite.guild.name}] Invite created by ${invite.inviter.tag} (${invite.code})`);
  },
};