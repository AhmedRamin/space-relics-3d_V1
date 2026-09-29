const express = require('express');
const controller = require('../controllers/explorerController');
const { chat, engines } = require('../controllers/chatController');
const { chatLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.get('/health', controller.health);
router.get('/catalog', controller.catalog);
router.get('/facets', controller.facets);
router.get('/search', controller.search);

router.get('/bodies', controller.bodies);
router.get('/bodies/:id/hardware', controller.bodyHardware);
router.get('/bodies/:id', controller.bodyDetail);

router.get('/missions', controller.missions);
router.get('/missions/:id', controller.mission);

router.get('/stations', controller.stations);
router.get('/stations/:id', controller.station);

router.get('/rockets', controller.rockets);
router.get('/rockets/:id', controller.rocket);

router.get('/moons', controller.moons);
router.get('/moons/:id', controller.moon);

router.get('/chat/engines', engines);
router.post('/chat', chatLimiter, chat);

module.exports = router;
