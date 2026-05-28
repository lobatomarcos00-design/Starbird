// src/utils/inviteCache.js
const { createLogger } = require('./logger');
const logger = createLogger('INVITE_CACHE');

const cache = new Map(); // guildId -> Map(code -> { inviterId, uses })

async function fetchAndCache(guild) {
  if (!guild.members.me.permissions.has('ManageGuild')) {
    logger.warn(`[${guild.name}] Missing ManageGuild – cannot fetch invites.`);
    return;
  }
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    invites.forEach(inv => map.set(inv.code, { inviterId: inv.inviter.id, uses: inv.uses }));
    cache.set(guild.id, map);
    logger.info(`[${guild.name}] Cached ${invites.size} invites.`);
    if (invites.size === 0) {
      logger.info(`[${guild.name}] No active invites found.`);
    }
  } catch (err) {
    logger.error(`[${guild.name}] Failed to fetch invites:`, err);
  }
}

function cacheInvite(guildId, code, inviterId, uses = 0) {
  if (!cache.has(guildId)) cache.set(guildId, new Map());
  cache.get(guildId).set(code, { inviterId, uses });
  logger.info(`[${guildId}] Cached new invite ${code} by ${inviterId}`);
}

function uncacheInvite(guildId, code) {
  if (cache.has(guildId)) {
    cache.get(guildId).delete(code);
    logger.info(`[${guildId}] Removed invite ${code} from cache`);
  }
}

async function findUsedInvite(guild) {
  if (!guild.members.me.permissions.has('ManageGuild')) {
    logger.warn(`[${guild.name}] Missing ManageGuild – cannot detect used invite.`);
    return null;
  }
  try {
    const newInvites = await guild.invites.fetch();
    const oldMap = cache.get(guild.id) || new Map();

    logger.info(`[${guild.name}] Comparing invites: cached=${oldMap.size}, current=${newInvites.size}`);

    let result = null;
    for (const [code, newInv] of newInvites) {
      const oldData = oldMap.get(code);
      if (!oldData) {
        // New invite created, but it wasn't used yet (uses should be 0)
        logger.info(`[${guild.name}] New invite found (not in cache): ${code} uses=${newInv.uses}`);
        continue;
      }
      if (newInv.uses > oldData.uses) {
        result = { code, inviterId: oldData.inviterId };
        logger.info(`[${guild.name}] Detected invite used: ${code} uses ${oldData.uses} -> ${newInv.uses} by ${oldData.inviterId}`);
        break;
      }
    }

    if (!result) {
      logger.info(`[${guild.name}] No invite use detected.`);
    }

    // Update cache with new data
    const newMap = new Map();
    newInvites.forEach(inv => newMap.set(inv.code, { inviterId: inv.inviter.id, uses: inv.uses }));
    cache.set(guild.id, newMap);

    return result;
  } catch (err) {
    logger.error(`[${guild.name}] findUsedInvite error:`, err);
    return null;
  }
}

module.exports = { fetchAndCache, cacheInvite, uncacheInvite, findUsedInvite };