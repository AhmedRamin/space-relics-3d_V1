const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');
const { answer } = require('../services/aiService');
const models = require('../services/modelProviders');
const web = require('../services/webKnowledge');

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw ApiError.badRequest('Body must be a JSON object');
  const message = body.message;
  if (typeof message !== 'string' || message.trim().length < 2) throw ApiError.badRequest('"message" is required');
  if (message.length > 1000) throw ApiError.badRequest('"message" must be at most 1000 characters');

  let context = null;
  if (body.context && typeof body.context === 'object' && body.context.id) {
    context = {
      kind: ['mission', 'station', 'rocket', 'body', 'moon'].includes(body.context.kind) ? body.context.kind : 'mission',
      id: String(body.context.id).slice(0, 120),
      name: body.context.name ? String(body.context.name).slice(0, 120) : undefined,
    };
  }

  const history = Array.isArray(body.history)
    ? body.history
        .slice(-6)
        .filter((entry) => entry && typeof entry.content === 'string')
        .map((entry) => ({ role: entry.role === 'assistant' ? 'assistant' : 'user', content: String(entry.content).slice(0, 1200) }))
    : [];

  return { message: message.trim(), context, history, useWeb: body.useWeb !== false };
}

/** POST /api/chat */
const chat = asyncHandler(async (req, res) => {
  const { message, context, history, useWeb } = validate(req.body);
  const result = await answer({ message, context, history, useWeb });
  res.json(result);
});

/** GET /api/chat/engines — what the guide can reach, for the UI badge. */
const engines = asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    data: {
      dataset: { available: true, missions: require('../data/store').countsFor('missions') },
      web: { available: web.enabled(), provider: 'Wikipedia REST API', keyRequired: false },
      models: models.describe(),
    },
  });
});

module.exports = { chat, engines };
