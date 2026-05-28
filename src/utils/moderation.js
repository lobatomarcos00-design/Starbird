// src/utils/moderation.js
const { PermissionsBitField, ChannelType } = require('discord.js');
const { getEntriesByKey, upsertEntry, deleteEntry } = require('./database');
const config = require('./config');
const { createLogger } = require('./logger');
const logger = createLogger('MODERATION');

// --- In‑memory trackers ---
const messageTimestamps = new Map();
const linkTimestamps = new Map();
const mentionTimestamps = new Map();
const lastMessages = new Map();

function addAndGetRecentCount(map, key, maxAgeMs) {
  const now = Date.now();
  if (!map.has(key)) map.set(key, []);
  const arr = map.get(key);
  arr.push(now);
  const cutoff = now - maxAgeMs;
  while (arr.length > 0 && arr[0] < cutoff) arr.shift();
  return arr.length;
}

function addAndGetLastMessages(key, content, maxCount = 4) {
  if (!lastMessages.has(key)) lastMessages.set(key, []);
  const arr = lastMessages.get(key);
  arr.push(content);
  if (arr.length > maxCount) arr.shift();
  return arr;
}

// --- Bad words ---
function loadBadWords(guildId) {
  const entry = getEntriesByKey(`badwords_${guildId}`, guildId);
  if (entry.length === 0) return [];
  try {
    return JSON.parse(entry[0].value);
  } catch {
    return [];
  }
}

function saveBadWords(guildId, words) {
  upsertEntry(`badwords_${guildId}`, guildId, 'system', JSON.stringify(words));
}

// --- Warn helpers ---
function getWarnCount(guildId, userId) {
  const entries = getEntriesByKey(`warn_${guildId}`, guildId);
  const entry = entries.find(e => e.userid === userId);
  return entry ? Number(entry.value) : 0;
}

function setWarnCount(guildId, userId, count) {
  upsertEntry(`warn_${guildId}`, guildId, userId, String(count));
}

function clearAllWarns(guildId) {
  const entries = getEntriesByKey(`warn_${guildId}`, guildId);
  for (const e of entries) {
    deleteEntry(`warn_${guildId}`, guildId, e.userid);
  }
  logger.info(`Cleared warns for guild ${guildId}`);
}

// --- Silenced role management ---
async function ensureSilencedRole(guild) {
  const guildId = guild.id;
  let roleId = config.get(`silencedRole_${guildId}`);
  let role = roleId ? guild.roles.cache.get(roleId) : null;

  if (!role) {
    role = await guild.roles.create({
      name: 'Silenced',
      color: 'd3324d',
      permissions: [],
      reason: 'Mute role for rule violations',
    });
    config.set(`silencedRole_${guildId}`, role.id);
    logger.info(`[${guild.name}] Created Silenced role (${role.id})`);
  }

  try {
    await role.setPosition(1);
  } catch (err) {
    logger.warn(`[${guild.name}] Could not reposition Silenced role: ${err.message}`);
  }

  await applySilencedOverwrites(guild, role);
  return role;
}

async function applySilencedOverwrites(guild, silencedRole) {
  const channels = guild.channels.cache.filter(
    c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice
  );

  for (const [, channel] of channels) {
    try {
      const overwrites = channel.permissionOverwrites.cache.map(o => o.toJSON());
      const filtered = overwrites.filter(o => o.id !== silencedRole.id);

      filtered.push({
        id: silencedRole.id,
        deny: [
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
        ],
        allow: [PermissionsBitField.Flags.ViewChannel],
      });

      await channel.edit({ permissionOverwrites: filtered });
      logger.info(`[${guild.name}] Updated Silenced overwrite in #${channel.name}`);
    } catch (err) {
      logger.error(`[${guild.name}] Failed to set Silenced overwrite for #${channel.name}: ${err.message}`);
    }
  }
}

// --- Mute / unmute logic ---
async function muteUser(guild, member, channelId) {
  const role = await ensureSilencedRole(guild);
  const defaultRoleId = config.get(`defaultRole_${guild.id}`);

  // Remove default role if assigned
  if (defaultRoleId && member.roles.cache.has(defaultRoleId)) {
    await member.roles.remove(defaultRoleId, 'Muted – default role removed').catch(() => {});
  }

  // Add Silenced role
  if (!member.roles.cache.has(role.id)) {
    await member.roles.add(role, 'Automated moderation: second offense');
  }

  // Save mute data: until timestamp, default role ID, and source channel
  const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const muteData = JSON.stringify({
    until,
    defaultRoleId,
    channelId,
  });
  upsertEntry(`mute_${guild.id}`, guild.id, member.id, muteData);

  logger.info(`[${guild.name}] ${member.user.tag} muted for 1 hour (channel: ${channelId})`);

  // Schedule auto‑unmute
  setTimeout(async () => {
    await unmuteUser(guild, member.id, 'Mute expired');
  }, 60 * 60 * 1000);
}

async function unmuteUser(guild, userId, reason = 'Unmuted') {
  const roleId = config.get(`silencedRole_${guild.id}`);
  const defaultRoleId = config.get(`defaultRole_${guild.id}`);
  const muteEntries = getEntriesByKey(`mute_${guild.id}`, guild.id);
  const muteEntry = muteEntries.find(e => e.userid === userId);

  let channelId = null;
  if (muteEntry) {
    try {
      const data = JSON.parse(muteEntry.value);
      channelId = data.channelId;
      defaultRoleId = data.defaultRoleId || defaultRoleId;
    } catch {}
    deleteEntry(`mute_${guild.id}`, guild.id, userId);
  }

  const member = await guild.members.fetch(userId).catch(() => null);

  if (member) {
    if (roleId && member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId, reason);
    }
    if (defaultRoleId && !member.roles.cache.has(defaultRoleId)) {
      await member.roles.add(defaultRoleId, reason);
    }
  }

  logger.info(`[${guild.name}] ${member ? member.user.tag : userId} unmuted. Reason: ${reason}`);

  // Send public unmute message in the original channel
  if (channelId) {
    const channel = guild.channels.cache.get(channelId);
    if (channel && guild.members.me.permissionsIn(channel).has(PermissionsBitField.Flags.SendMessages)) {
      const embed = {
        color: 0x57f287, // green
        title: '<:Positive:1508838207838486579> Mute Expired',
        description: `${member ? member.toString() : `<@${userId}>`} has been unmuted.`,
        footer: { text: reason },
        timestamp: new Date().toISOString(),
      };
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
}

async function recoverMutes(client) {
  for (const guild of client.guilds.cache.values()) {
    const muteEntries = getEntriesByKey(`mute_${guild.id}`, guild.id);
    const now = Date.now();

    for (const entry of muteEntries) {
      const userId = entry.userid;
      let data;
      try {
        data = JSON.parse(entry.value);
      } catch {
        data = { until: entry.value, defaultRoleId: null, channelId: null };
      }

      const until = new Date(data.until).getTime();
      const remaining = until - now;

      if (remaining <= 0) {
        await unmuteUser(guild, userId, 'Mute expired (recovered)');
      } else {
        setTimeout(async () => {
          await unmuteUser(guild, userId, 'Mute expired (recovered)');
        }, remaining);
      }
    }
  }
}

async function resetAllWarnsAndMutes(guild) {
  const guildId = guild.id;

  // Unmute every currently muted member
  const muteEntries = getEntriesByKey(`mute_${guildId}`, guildId);
  for (const entry of muteEntries) {
    const userId = entry.userid;
    await unmuteUser(guild, userId, 'Warns reset by admin');
  }

  // Clear warns
  clearAllWarns(guildId);
  logger.info(`[${guild.name}] All warns and mutes reset by admin`);
}

// --- Admin notification ---
async function notifyAdmins(guild, offender, offenseType, warnCount, silencedApplied) {
  const admins = guild.members.cache.filter(m =>
    m.permissions.has('ManageGuild') && !m.user.bot
  );
  const embed = {
    color: 0xd3324d,
    title: '🚨 Moderation Alert',
    fields: [
      { name: 'User', value: `${offender.tag} (${offender.id})`, inline: true },
      { name: 'Offense', value: offenseType, inline: true },
      { name: 'Warns', value: `${warnCount}`, inline: true },
      { name: 'Action', value: silencedApplied ? '🔇 Silenced (1 hour)' : '⚠️ Warned', inline: false },
    ],
    timestamp: new Date().toISOString(),
  };
  for (const admin of admins.values()) {
    try {
      await admin.send({ embeds: [embed] });
    } catch (err) { /* DM closed */ }
  }
}

// --- Detection functions (unchanged) ---
async function checkSpam(message) {
  const key = `${message.guild.id}-${message.author.id}`;
  const count = addAndGetRecentCount(messageTimestamps, key, 5000);
  if (count > 7) return 'Fast Message Spam';
  return null;
}

async function checkDuplicate(message) {
  const content = message.content;
  if (content.length > 50) {
    if (/(.)\1{10,}/.test(content)) return 'Repeated Character Spam';
    const words = content.toLowerCase().split(/\s+/);
    const wordCounts = {};
    for (const w of words) {
      if (w.length < 2) continue;
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
    const maxRepeats = Math.max(...Object.values(wordCounts));
    if (maxRepeats > 5) return 'Repeated Word Spam';
  }
  const key = `${message.guild.id}-${message.author.id}`;
  const recent = addAndGetLastMessages(key, content, 4);
  if (recent.length === 4 && new Set(recent).size === 1) return 'Duplicate Message Spam';
  return null;
}

async function checkLinkCooldown(message) {
  if (!message.content.match(/https?:\/\/\S+|discord(?:\.gg|\.com\/invite)\/\S+/i)) return null;
  const key = `${message.guild.id}-${message.author.id}`;
  const count = addAndGetRecentCount(linkTimestamps, key, 30000);
  if (count > 5) return 'Link Spam';
  return null;
}

async function checkMassMentions(message) {
  if (message.mentions.users.size >= 10) return 'Mass Mentions';
  return null;
}

async function checkNewlines(message) {
  if ((message.content.match(/\n/g) || []).length > 10) return 'Excessive Newlines';
  return null;
}

async function checkMentionCooldown(message) {
  if (message.mentions.users.size === 0) return null;
  const key = `${message.guild.id}-${message.author.id}`;
  const count = addAndGetRecentCount(mentionTimestamps, key, 30000);
  if (count > 5) return 'Mention Spam';
  return null;
}

async function checkBadWords(message) {
  const badWords = loadBadWords(message.guild.id);
  if (badWords.length === 0) return null;
  const lower = message.content.toLowerCase();
  for (const word of badWords) {
    if (lower.includes(word.toLowerCase())) return `Bad Word: ${word}`;
  }
  return null;
}

// --- Main moderation handler ---
async function moderateMessage(message) {
  if (!message.guild || message.author.bot || message.member.permissions.has('ManageGuild')) return false;

  const checks = [
    checkSpam,
    checkDuplicate,
    checkLinkCooldown,
    checkMassMentions,
    checkNewlines,
    checkMentionCooldown,
    checkBadWords,
  ];
  let offense = null;
  for (const check of checks) {
    offense = await check(message);
    if (offense) break;
  }
  if (!offense) return false;

  try {
    await message.delete();
  } catch (err) {
    logger.warn(`[${message.guild.name}] Could not delete message: ${err.message}`);
  }

  const guild = message.guild;
  const userId = message.author.id;
  let warnCount = getWarnCount(guild.id, userId);
  warnCount++;
  setWarnCount(guild.id, userId, warnCount);

  let silencedApplied = false;
  if (warnCount >= 2) {
    const member = message.member;
    if (member) {
      await muteUser(guild, member, message.channel.id);
      silencedApplied = true;
    }
  }

  // Public alert embed
  const embed = {
    color: 0xd3324d,
    title: '⚠️ Moderation Alert',
    description: `${message.author} has been warned for **${offense}**.`,
    fields: [
      { name: 'Warn count', value: `${warnCount}`, inline: true },
      { name: 'Status', value: silencedApplied ? '🔇 Silenced (1 hour)' : '⚠️ Warned', inline: true },
    ],
    footer: { text: 'Repeated offenses will result in a mute.' },
    timestamp: new Date().toISOString(),
  };

  const alertMsg = await message.channel.send({ embeds: [embed] }).catch(() => null);

  notifyAdmins(guild, message.author, offense, warnCount, silencedApplied);
  logger.info(`[${guild.name}] ${message.author.tag} warned for ${offense} (warns: ${warnCount}, silenced: ${silencedApplied})`);
  return true;
}

// Daily warn reset
function scheduleWarnReset(client) {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const delay = midnight.getTime() - now.getTime();
  setTimeout(() => {
    for (const guild of client.guilds.cache.values()) {
      clearAllWarns(guild.id);
      logger.info(`[${guild.name}] Daily warn reset`);
    }
    scheduleWarnReset(client);
  }, delay);
}

module.exports = {
  moderateMessage,
  recoverMutes,
  scheduleWarnReset,
  loadBadWords,
  saveBadWords,
  clearAllWarns,
  resetAllWarnsAndMutes,
  muteUser,
};