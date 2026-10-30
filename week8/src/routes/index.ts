import { Router } from '../core/router.js';
import { registerAdmin } from './admin.js';
import { registerAuth } from './auth.js';
import { registerEngage } from './engage.js';
import { registerPublic } from './public.js';
import { registerStudio } from './studio.js';

export function buildRouter(): Router {
  const router = new Router();
  registerPublic(router);
  registerAuth(router);
  registerEngage(router);
  registerStudio(router);
  registerAdmin(router);
  return router;
}
