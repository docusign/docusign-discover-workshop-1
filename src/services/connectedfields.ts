import path from "path";
import { ConceptDeclaration, ModelManager } from "@accordproject/concerto-core";
import { IReq, IRes } from "../utils/types";
import { ModelManagerUtil } from "../utils/modelManagerUtil";

import {
  GetTypeDefinitionsResponse,
  TypeNameInfo,
  VerifyBody,
  VerifyResponse,
} from "../models/connectedfields";

import { verifyBankAccountOpening } from "../utils/dataVerification";

enum ErrorCode {
  INTERNAL_ERROR = "INTERNAL_ERROR",
  NOT_FOUND = "NOT_FOUND",
  BAD_REQUEST = "BAD_REQUEST",
}

type ErrorResponse = { message: string; code: string };

const generateErrorResponse = (code: ErrorCode, message: unknown): ErrorResponse => ({
  code,
  message: String(message),
});

const MODEL_MANAGER: ModelManager = ModelManagerUtil.createModelManagerFromCTO(
  path.join(__dirname, "../dataModel/model.cto")
);
const MODEL_FILE = MODEL_MANAGER.getModelFile("org.example@1.0.0");
const CONCEPTS: ConceptDeclaration[] = MODEL_MANAGER.getConceptDeclarations();
const DECLARATIONS = MODEL_FILE.getAllDeclarations().map((decl) => decl.ast);

/**
 * GET /connected-fields/type-names
 * Returns the verifiable concepts from model.cto
 */
export const getTypeNames = (_req: IReq, res: IRes) => {
  try {
    const typeNames: TypeNameInfo[] = [
      {
        typeName: "BankAccountOpening",
        label: "Bank Account Opening"
      },
    ];
    const body = { typeNames };
    return res.status(200).json(body).send();
  } catch (err: any) {
    return res
      .status(500)
      .json(generateErrorResponse(ErrorCode.INTERNAL_ERROR, err?.message || err))
      .send();
  }
};

export const getTypeDefinitions = (_req: IReq, res: IRes): IRes => {
  try {
    const defs: GetTypeDefinitionsResponse = {
      declarations: DECLARATIONS as unknown as import("@accordproject/concerto-types").DeclarationUnion[],
    };

    return res.status(200).json(defs).send();
  } catch (err: any) {
    return res
      .status(500)
      .json(generateErrorResponse(ErrorCode.INTERNAL_ERROR, err?.message || err))
      .send();
  }
};

export const verify = (req: IReq, res: IRes): IRes => {
  const { typeName, data } = (req.body as unknown as VerifyBody);

  if (!typeName) {
    return res
      .status(400)
      .json(generateErrorResponse(ErrorCode.BAD_REQUEST, "Missing typeName in request"))
      .send();
  }

  if (!data) {
    return res
      .status(400)
      .json(generateErrorResponse(ErrorCode.BAD_REQUEST, "Missing data in request"))
      .send();
  }

  try {
    switch (typeName) {
      case "BankAccountOpening": {
        const result = verifyBankAccountOpening(data as any);
        const response: VerifyResponse = result.matched
          ? {
              verified: true,
              verifyResponseMessage: "Verification succeeded",
            }
          : {
              verified: false,
              verifyResponseMessage: "Verification failed",
              verifyFailureReason: result?.message ?? "Unknown reason",
            };

        return res.status(200).json(response).send();
      }

      default:
        return res
          .status(400)
          .json(
            generateErrorResponse(
              ErrorCode.BAD_REQUEST,
              `Type: [${typeName}] is not verifiable`
            )
          )
          .send();
    }
  } catch (err: any) {
    console.error(`Verification error:`, err);
    return res
      .status(500)
      .json(generateErrorResponse(ErrorCode.INTERNAL_ERROR, err?.message || err))
      .send();
  }
};
