import { Router } from '../core/router.js';
import { registerAdmin } from './admin.js';
import { registerAuth } from './auth.js';
import { registerDashboard } from './dashboard.js';
import { registerEmployer } from './employer.js';
import { registerMessages } from './messages.js';
import { registerPublic } from './public.js';
import { registerWallet } from './wallet.js';

export function buildRouter(): Router {
  const router = new Router();
  registerPublic(router);
  registerAuth(router);
  registerDashboard(router);
  registerEmployer(router);
  registerMessages(router);
  registerWallet(router);
  registerAdmin(router);
  return router;
}
