import { handleSinaApiProxyRequest } from '../../backend/core/sina.js';
import {
  createWebRequestFromExpress,
  sendWebResponseToExpress
} from '../adapters/web-interop.js';

function registerZhiboProxyRoute(app, { sinaOrigin, apiTimeoutMs }) {
  app.use('/api/zhibo', async (req, res) => {
    const request = createWebRequestFromExpress(req);
    const response = await handleSinaApiProxyRequest(request, {
      sinaOrigin,
      apiTimeoutMs
    });

    await sendWebResponseToExpress(res, response);
  });
}

export {
  registerZhiboProxyRoute
};
