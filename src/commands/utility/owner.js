module.exports = {
  name: 'owner',
  description: 'reply with info about the bots creator',
  //equiredPermissions: ['Administrator'],
  async execute(message, args) {
    await message.channel.send('*This bot is made by Curufim*<:star:1508838174305030306> \n *lobato.marcos00@gmail.com*');
    console.log(`Ping executed`);
  }
};