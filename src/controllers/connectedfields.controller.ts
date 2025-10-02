import { Router } from 'express';

import Paths from '../constants/paths';
import { expressjwt as jwt } from 'express-jwt';
import { checkSchema } from 'express-validator';
import checkValidationErrors from '../middleware/checkValidationErrors';
import env from '../env';
import {
  connectedFieldsGetTypeDefinitionsRecordBody,
  connectedFieldsGetTypeNamesRecordBody,
  connectedFieldsVerifyBody,
} from '../validationSchemas/connectedfields';
import { getTypeDefinitions, getTypeNames, verify } from '../services/connectedfields';

const connectedFieldsRouter = Router();

connectedFieldsRouter.post(
  Paths.ConnectedFields.GetTypeNames.Post,
  jwt({
    secret: env.JWT_SECRET_KEY,
    algorithms: ['HS256'],
  }),
  checkSchema(connectedFieldsGetTypeNamesRecordBody, ['body']),
  checkValidationErrors,
  getTypeNames,
);

connectedFieldsRouter.post(
  Paths.ConnectedFields.GetTypeDefinitions.Post,
  jwt({
    secret: env.JWT_SECRET_KEY,
    algorithms: ['HS256'],
  }),
  checkSchema(connectedFieldsGetTypeDefinitionsRecordBody, ['body']),
  checkValidationErrors,
  getTypeDefinitions,
);

connectedFieldsRouter.post(
  Paths.ConnectedFields.Verify.Post,
  jwt({
    secret: env.JWT_SECRET_KEY,
    algorithms: ['HS256'],
  }),
  checkSchema(connectedFieldsVerifyBody, ['body']),
  checkValidationErrors,
  verify,
);

export default connectedFieldsRouter;
