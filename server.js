const { createApp } = require('./server/create-app');
const { PORT } = require('./server/config');

const app = createApp();

app.listen(PORT, () => {
  console.log(`Sina 7x24 viewer is running at http://127.0.0.1:${PORT}`);
});
