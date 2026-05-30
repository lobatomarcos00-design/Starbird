// src/utils/serverSetup.js
const { PermissionsBitField, ChannelType } = require('discord.js');
const config = require('./config');
const { createLogger } = require('./logger');
const logger = createLogger('SERVER_SETUP');

async function clearChannel(channel) {
    if (!channel.manageable) return;
    let messages;
    do {
        messages = await channel.messages.fetch({ limit: 100 });
        if (messages.size > 0) await channel.bulkDelete(messages, true).catch(() => { });
    } while (messages.size >= 100);
}

async function ensureDefaultRole(guild) {
    const guildId = guild.id;
    let roleId = config.get(`defaultRole_${guildId}`);
    if (roleId) {
        const role = guild.roles.cache.get(roleId);
        if (role) return role;
    }
    const role = await guild.roles.create({
        name: 'member',
        color: '9b59b6',
        hoist: true,
        permissions: [],
        reason: 'Default role for new members',
    });
    try { await role.setPosition(1); } catch { }
    config.set(`defaultRole_${guildId}`, role.id);
    return role;
}

async function ensureWelcomeChannel(guild) {
    const guildId = guild.id;
    const existingId = config.get(`welcomeChannel_${guildId}`);
    if (existingId) {
        const channel = guild.channels.cache.get(existingId);
        if (channel && channel.type === ChannelType.GuildText) return channel;
    }
    const channel = await guild.channels.create({
        name: '🌱-welcome',
        type: ChannelType.GuildText,
        position: 9999,
        permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }],
        reason: 'Default welcome channel',
    });
    config.set(`welcomeChannel_${guildId}`, channel.id);
    return channel;
}

async function lockChannels(guild, defaultRole, welcomeChannel) {
    const everyoneId = guild.roles.everyone.id;
    const defaultRoleId = defaultRole.id;
    const channels = guild.channels.cache.filter(
        c => (c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice) && c.id !== welcomeChannel.id
    );
    for (const [, channel] of channels) {
        try {
            const overwrites = channel.permissionOverwrites.cache.map(o => o.toJSON());
            let filtered = overwrites.filter(o => o.id !== everyoneId && o.id !== defaultRoleId);
            filtered.push({ id: everyoneId, deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak], allow: [] });
            filtered.push({ id: defaultRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak], deny: [] });
            await channel.edit({ permissionOverwrites: filtered });
        } catch (err) { logger.error(`Lock channel error: ${err.message}`); }
    }
}

async function performServerSetup(guild) {
    const botMember = guild.members.me;
    if (!botMember.permissions.has('ManageRoles') || !botMember.permissions.has('ManageChannels')) {
        logger.warn(`[${guild.name}] Missing permissions for setup.`);
        return;
    }

    // --- Meteion role (second highest) ---
    let meteionRole = guild.roles.cache.find(r => r.name === 'Meteion');
    if (!meteionRole) {
        meteionRole = await guild.roles.create({
            name: 'Meteion',
            color: '215db1',
            hoist: false,
            permissions: [],
            reason: 'Bot admin role',
        });
        logger.info(`[${guild.name}] Created Meteion role.`);
    } else {
        logger.info(`[${guild.name}] Meteion role already exists.`);
    }

    // Move it to the second position (just below the highest role)
    try {
        const topRole = guild.roles.highest;  // the highest role in the server
        // If the top role is the Meteion role itself, we can't move it below itself – skip
        if (topRole.id !== meteionRole.id) {
            const targetPosition = Math.max(1, topRole.position - 1);
            await meteionRole.setPosition(targetPosition);
            logger.info(`[${guild.name}] Meteion role positioned at ${targetPosition}`);
        }
    } catch (err) {
        logger.warn(`[${guild.name}] Could not move Meteion role to second position: ${err.message}`);
        logger.warn('Make sure the bot has Administrator permission or its role is already near the top.');
    }

    if (!botMember.roles.cache.has(meteionRole.id)) {
        await botMember.roles.add(meteionRole);
    }

    // Stats channel
    const statsName = '📊-statistics';
    let statsChannel = guild.channels.cache.find(c => c.name === statsName && c.type === ChannelType.GuildText);
    if (statsChannel) {
        await clearChannel(statsChannel).catch(() => { });
    } else {
        statsChannel = await guild.channels.create({ name: statsName, type: ChannelType.GuildText, permissionOverwrites: [{ id: guild.id, deny: [PermissionsBitField.Flags.SendMessages] }], reason: 'Server statistics' });
    }
    const embed = { color: 0x215db1, title: '📊 Server Statistics', description: 'No data yet.', footer: { text: `Last updated: ${new Date().toLocaleString()}` } };
    const msg = await statsChannel.send({ embeds: [embed] });
    config.set(`statsChannel_${guild.id}`, statsChannel.id);
    config.set(`statsMessage_${guild.id}`, msg.id);

    // Default role & lockdown
    const defaultRole = await ensureDefaultRole(guild);
    const welcomeChannel = await ensureWelcomeChannel(guild);
    await lockChannels(guild, defaultRole, welcomeChannel);

    // Mark as initialised
    config.set(`setupDone_${guild.id}`, true);

    // Setup guide (only in guildCreate, skip here if already done)
    logger.info(`[${guild.name}] Server setup completed.`);
}

module.exports = { performServerSetup };