const { getEntriesByKey } = require('../../utils/database');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:nextbirthday');

module.exports = {
    name: 'nextbirthday',
    description: 'Show whose birthday is coming up next in this server.',
    async execute(message, args) {
        logger.info(`Executed by ${message.author.tag} in ${message.guild.name}`);

        try {
            const entries = getEntriesByKey('birthday', message.guild.id);
            if (entries.length === 0) {
                return message.reply('📭 No birthdays stored.');
            }

            const today = new Date();
            const todayDay = today.getUTCDate();
            const todayMonth = today.getUTCMonth() + 1;

            // Parse and sort by (month, day) for easy comparison
            const parsed = entries.map(e => {
                const parts = e.value.split('/');
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                return { ...e, day, month };
            }).sort((a, b) => {
                if (a.month !== b.month) return a.month - b.month;
                return a.day - b.day;
            });

            // Find the next birthday (including today if not yet passed)
            let next = null;
            for (const entry of parsed) {
                if (entry.month > todayMonth || (entry.month === todayMonth && entry.day >= todayDay)) {
                    next = entry;
                    break;
                }
            }

            // If none found after today, wrap around to the first next year
            if (!next && parsed.length > 0) {
                next = parsed[0]; // earliest in the list
            }

            if (!next) {
                return message.reply('<:Negative:1508838218043363419> Could not determine next birthday.');
            }

            const user = await message.guild.members.fetch(next.userid).catch(() => null);
            const userName = user ? user.user.tag : next.userid;

            await message.reply(`<:cake:1508838162401857718> **Next birthday:** ${userName} on ${next.value}`);
        } catch (error) {
            logger.error('Nextbirthday failed:', error);
            await message.reply('<:Negative:1508838218043363419> Something went wrong.');
        }
    },
};