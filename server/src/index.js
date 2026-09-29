const { createApp } = require('./app');
const store = require('./data/store');

const PORT = Number(process.env.PORT || 4000);

// Load the data file before serving: fail loudly and clearly if it is missing.
try {
  store.load();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(`[boot] ${err.message}`);
  process.exit(1);
}

const app = createApp();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[boot] Space Relics 3D API → http://localhost:${PORT}/api`);
});
