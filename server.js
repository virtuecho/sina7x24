import { createApp } from './server/create-app.js';
import { PORT } from './server/config.js';

const app = createApp();

app.listen(PORT, () => {
  console.log(`Sina 7x24 viewer is running at http://127.0.0.1:${PORT}`);
});
