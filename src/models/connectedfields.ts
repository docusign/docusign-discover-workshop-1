import { DeclarationUnion } from '@accordproject/concerto-types';

export interface CreateRecordResponse {
  /**
   * The identifier of the new record.
   * Note that the external source may not accept the provided identifier and choose its own.
   * In any case, this represents the actual record identifier applied, if record creation is successful.
   */
  recordId: string;
}

export type GetTypeNamesBody = void;

export type GetTypeNamesResponse = {
  /**
   * A collection of type names whose converted schemas the client is trying to retrieve.
   */
  typeNames: TypeNameInfo[];
};

/**
 * The error information given when type fails to be retrieved or transformed
 */
export type GetTypeDefinitionsError = {
  typeName: string;
  code: GetTypeDefinitionsErrorCode;
  message: string;
};

/**
 *  An exhaustive set of reason codes for the failure
 */
export enum GetTypeDefinitionsErrorCode {
  SCHEMA_RETRIEVAL_FAILED,
  SCHEMA_TRANSFORMATION_FAILED,
  UNKNOWN,
}

export type TypeNameInfo = {
  /**
   * Name of the type
   */
  typeName: string;

  /**
   * A display friendly name of the underlying type that can be used to render on UX canvases
   */
  label: string;

  /**
   * A help text describing the purpose/use of the type
   */
  description?: string;
};

export type GetTypeDefinitionsBody = {
  /**
   * A collection of type names whose converted schemas the client is trying to retrieve.
   */
  typeNames: string[];
};

export type GetTypeDefinitionsResponse = {
  /**
   * The converted list of schemas present in the external system
   * See https://concerto.accordproject.org/docs/design/specification/model-classes
   */
  declarations: DeclarationUnion[];

  /**
   * A list of errors associated with fetching or transforming the schemas
   */
  errors?: GetTypeDefinitionsError[];
};

export type VerifyBody = {
  /**
   * The type name of the record that is being verified which can be retrieved using the GetTypeNames action.
   */
  typeName: string;

  /**
   * A unique key the application may use to identify duplicate (retry) requests.
   */
  idempotencyKey: string;

  /**
   * Data to verify
   */
  data: object;
};

export type VerifyResponse = {
  /**
   * Indicates whether the verification was successful or not.
   */
  verified: boolean;

  /**
   * Provides information on the verification result.
   */
  verifyResponseMessage: string;

  /**
   * (Optional) Provides the reason for verification failure, if the verification was unsuccessful.
   */
  verifyFailureReason?: string;

  /**
   * (Optional) Code representing the specific result of the verification process.
   */
  verificationResultCode?: string;

  /**
   * (Optional) A descriptive message providing more details about the verification result.
   */
  verificationResultDescription?: string;

  /**
   * (Optional) A list of suggested actions or fixes that could resolve the verification failure.
   * Each object in the array contains information about a recommended fix.
   */
  suggestions?: object[];

  /**
   * (Optional) Any additional data or metadata that needs to be passed through from the verification process. This might contain information relevant for further processing or troubleshooting.
   */
  passthroughResponseData?: object;
};
