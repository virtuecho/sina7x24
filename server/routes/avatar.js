import { handleAvatarRequest } from '../../backend/core/avatar.js';
import {
  createWebRequestFromExpress,
  sendWebResponseToExpress
} from '../adapters/web-interop.js';

function registerAvatarRoute(app, { avatarTimeoutMs, allowedImageHostSuffixes }) {
  app.get('/api/avatar', async (req, res) => {
    const request = createWebRequestFromExpress(req);
    const response = await handleAvatarRequest(request, {
      avatarTimeoutMs,
      allowedImageHostSuffixes
    });

    await sendWebResponseToExpress(res, response);
  });
}

export {
  registerAvatarRoute
};
