import express from 'express';
import { getCurrentActor } from './controller';

const router = express.Router();

router.get('/me', getCurrentActor);

export { router as meRouter };
