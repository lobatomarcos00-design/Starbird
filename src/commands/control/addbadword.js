const { saveBadWords, loadBadWords } = require('../../utils/moderation');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:addbadwords');

module.exports = {
  name: 'addbadwords',
  description: 'Add bad words to the server filter. Usage: !addbadwords word1,word2,...',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    if (args.length === 0) return message.channel.send('Usage: `!addbadwords word1,word2,...`');
    const input = args.join(' ').split(',').map(w => w.trim()).filter(w => w.length > 0);
    if (input.length === 0) return message.channel.send('Please provide at least one word.');

    const currentWords = loadBadWords(message.guild.id);
    const newWords = [...new Set([...currentWords, ...input])];
    saveBadWords(message.guild.id, newWords);
    logger.info(`Added bad words to ${message.guild.name}: ${input}`);
    await message.channel.send(`<:Positive:1508838207838486579> Added bad words: ${input.join(', ')}`);
  },
};