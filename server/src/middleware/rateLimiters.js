const rateLimit = require('express-rate-limit');

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const max = Number(process.env.RATE_LIMIT_MAX || 600);
const chatMax = Number(process.env.CHAT_RATE_LIMIT_MAX || 60);

const reply = (message) => (req, res) =>
  res.status(429).json({ ok: false, error: { message, code: 'RATE_LIMITED' } });

const apiLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: reply('Too many requests — slow down a little.'),
});

const chatLimiter = rateLimit({
  windowMs,
  max: chatMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: reply('Too many questions in a short time. Try again shortly.'),
});

module.exports = { apiLimiter, chatLimiter };
