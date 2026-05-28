// src/commands/control/removebadword.js
const { loadBadWords, saveBadWords } = require('../../utils/moderation');
const { createLogger } = require('../../utils/logger');
const logger = createLogger('COMMAND:removebadword');

module.exports = {
  name: 'removebadword',
  description: 'Remove a word from the server bad‑words list.',
  requiredPermissions: ['ManageGuild'],
  async execute(message, args) {
    if (args.length === 0) {
      return message.channel.send('Usage: `!removebadword <word>`');
    }

    const wordToRemove = args.join(' ').trim().toLowerCase();
    const guildId = message.guild.id;

    // Load current words
    const currentWords = loadBadWords(guildId);
    if (currentWords.length === 0) {
      return message.channel.send('📭 The bad‑words list is already empty.');
    }

    // Find the word (case‑insensitive)
    const index = currentWords.findIndex(w => w.toLowerCase() === wordToRemove);
    if (index === -1) {
      return message.channel.send(`❌ \`${wordToRemove}\` is not in the bad‑words list.`);
    }

    // Remove the word, save, and confirm
    currentWords.splice(index, 1);
    saveBadWords(guildId, currentWords);

    logger.info(`[${message.guild.name}] Removed bad word "${wordToRemove}" by ${message.author.tag}`);
    await message.channel.send(`<:Positive:1508838207838486579> \`${wordToRemove}\` has been removed from the bad‑words list.`);
  },
};