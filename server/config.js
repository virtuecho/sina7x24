const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  ROOT_DIR,
  SINA_ORIGIN: 'https://zhibo.sina.com.cn',
  API_TIMEOUT_MS: 10000,
  AVATAR_TIMEOUT_MS: 10000,
  DISCORD_WEBHOOK_TIMEOUT_MS: 15000,
  ALLOWED_IMAGE_HOST_SUFFIXES: ['sinaimg.cn', 'sinaimg.com'],
  ALLOWED_DISCORD_HOST_SUFFIXES: ['discord.com', 'discordapp.com']
};
