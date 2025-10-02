import { Router } from 'express';
import Paths from '../constants/paths';
import authRouter from './auth.controller';
import connectedFieldsRouter from './connectedfields.controller';

const apiRouter = Router();

apiRouter.use(Paths.ConnectedFields.Base, connectedFieldsRouter);

apiRouter.use(Paths.Auth.Base, authRouter);

export default apiRouter;
