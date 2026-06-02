const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const fs = require('fs');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { createLogger } = require('./utils/logger');

const logger = createLogger('CORE');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

const commandsDir = path.join(__dirname, 'commands');
if (fs.existsSync(commandsDir)) {
  const folders = fs.readdirSync(commandsDir).filter(item => {
    return fs.statSync(path.join(commandsDir, item)).isDirectory();
  });

  for (const folder of folders) {
    const folderPath = path.join(commandsDir, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const command = require(`./commands/${folder}/${file}`);
      client.commands.set(command.name, command);
      logger.info(`Loaded command: ${command.name} (${folder})`);
    }
  }
} else {
  logger.warn('Commands directory not found.');
}

// Load events
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    logger.info(`Loaded event: ${event.name}`);
  }
} else {
  logger.warn('Events directory not found.');
}

const token = process.env.TOKEN;
if (!token) {
  logger.error('No token found in .env file!');
  process.exit(1);
}

client.login(token).catch(err => {
  logger.error('Failed to login:', err);
  process.exit(1);
});
printf('Bot is starting...');
