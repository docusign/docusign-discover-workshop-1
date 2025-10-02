import { Schema } from 'express-validator';

export const connectedFieldsGetTypeNamesRecordBody: Schema = {};

export const connectedFieldsGetTypeDefinitionsRecordBody: Schema = {
  typeNames: { isArray: true }
}

export const connectedFieldsVerifyBody: Schema = {
    typeName: { isString: true },
    idempotencyKey: { isString: true },
    data: { isObject: true }
}