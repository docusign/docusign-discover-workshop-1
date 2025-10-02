import path from "path";
import { ConceptDeclaration, ModelManager } from "@accordproject/concerto-core";

import { IReq, IRes } from "../utils/types";
import { ModelManagerUtil } from "../utils/modelManagerUtil";

import {
  GetTypeDefinitionsBody,
  GetTypeNamesBody,
  TypeNameInfo,
  VerifyBody,
} from "../models/connectedfields";

import {
  verifyEmail,
  verifyPhoneNumber,
  verifyPostalAddress,
  verifyBankAccount,
  verifyBankAccountOwner,
  verifySSN,
  verifyBusinessEntity,
  // Removed: verifyVehicleIdentification
} from "../utils/dataVerification";

/**
 * NOTE:
 * - Vehicle CSV "database" and vehicle verification have been removed.
 * - This service now focuses on bank account related verification paths (plus
 *   the existing mock verifiers for email/phone/address/etc.).
 */

enum DECORATOR_NAMES {
  TERM = "Term",
}

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

/**
 * Concerto model manager initialisation
 * (kept as in the original service so type discovery endpoints remain functional)
 */
const MODEL_MANAGER: ModelManager = ModelManagerUtil.createModelManagerFromCTO(
  path.join(__dirname, "../dataModel/model.cto")
);
const MODEL_FILE = MODEL_MANAGER.getModelFile("org.example@1.0.0");
const CONCEPTS: ConceptDeclaration[] = MODEL_MANAGER.getConceptDeclarations();
const DECLARATIONS = MODEL_FILE.getAllDeclarations().map((decl) => decl.ast);

/**
 * GET /connected-fields/type-names
 * Returns the concept type names that are "verifiable".
 */
export const getTypeNames = (req: IReq<GetTypeNamesBody>, res: IRes): IRes => {
  const typeNameInfos: TypeNameInfo[] = CONCEPTS.map((concept: ConceptDeclaration) => {
    return {
      typeName: concept.getName(),
      label: concept.getDecorator(DECORATOR_NAMES.TERM).getArguments()[0] as unknown as string,
    };
  });

  return res.json({ typeNames: typeNameInfos as TypeNameInfo[] });
};

/**
 * GET /connected-fields/type-definitions
 * Provides field definitions for each supported input type.
 * (Kept concise, you can expand each definition to mirror your model.cto exactly.)
 */
export const getTypeDefinitions = (req: IReq<GetTypeDefinitionsBody>, res: IRes): IRes => {
  const {
    body: { typeNames },
  } = req;
  if (!typeNames) {
    return res.status(400).json(generateErrorResponse(ErrorCode.BAD_REQUEST, 'Missing typeNames in request')).send();
  }
  MODEL_MANAGER.addCTOModel;
  try {
    return res.json({
      declarations: DECLARATIONS
    });
  } catch (err) {
    console.log(`Encountered an error getting type definitions: ${err.message}`);
    return res.status(500).json(generateErrorResponse(ErrorCode.INTERNAL_ERROR, err)).send();
  }
};

/**
 * POST /connected-fields/verify
 * Routes incoming verification by typeName.
 */
export const verify = async (req: IReq<VerifyBody>, res: IRes): Promise<IRes> => {
  const {
    body: { typeName, idempotencyKey, data },
  } = req;

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
      case "VerifyEmailInput":
        return res.status(200).json(verifyEmail(data as any)).send();

      case "VerifyPhoneNumberInput":
        return res.status(200).json(verifyPhoneNumber(data as any)).send();

      case "PostalAddress":
        return res.status(200).json(verifyPostalAddress(data as any)).send();

      case "VerifyBankAccountInput":
        return res.status(200).json(verifyBankAccount(data as any)).send();

      case "VerifyBankAccountOwnerInput":
        return res.status(200).json(verifyBankAccountOwner(data as any)).send();

      case "VerifySocialSecurityNumberInput":
        return res.status(200).json(verifySSN(data as any)).send();

      case "VerifyBusinessEntityInput":
        return res.status(200).json(verifyBusinessEntity(data as any)).send();

      // Removed:
      // case "VehicleIdentification":
      //   return res.status(200).json(verifyVehicleIdentification(data, VEHICLE_DB)).send();

      // Optional: if you add a concept like BankAccountIdentification in your CTO
      case "BankAccountOpening":
        const result = await verifyBankAccount(data as any);
        console.log('verifyBankAccount result:', result, 'type:', typeof result);
        return res.status(200).json(result);


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
    // eslint-disable-next-line no-console
    console.log(`Encountered an error verifying type: ${err?.message || err}`);
    return res
      .status(500)
      .json(generateErrorResponse(ErrorCode.INTERNAL_ERROR, err?.message || err))
      .send();
  }
};
