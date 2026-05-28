const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:backup');

module.exports = {
    name: 'backup',
    description: 'Manually send a backup of the database and config files.',
    requiredPermissions: ['ManageGuild'],
    async execute(message, args) {
        const dbPath = path.join(process.cwd(), 'database.json');
        const configPath = path.join(process.cwd(), 'config.json');

        const files = [];
        if (fs.existsSync(dbPath)) files.push(dbPath);
        if (fs.existsSync(configPath)) files.push(configPath);

        if (files.length === 0) {
            return message.reply('📭 No backup files found.');
        }

        try {
            await message.reply({
                content: '<:package:1508838121482096670> Here are the current backup files:',
                files: files,
            });
            logger.info(`Manual backup sent by ${message.author.tag} in ${message.guild.name}`);
        } catch (error) {
            logger.error('Backup command failed:', error);
            await message.reply('<:Negative:1508838218043363419> Failed to send backup.');
        }
    },
};