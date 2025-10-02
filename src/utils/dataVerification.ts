/**
 * Centralized "verification" utilities used by the connected fields service.
 * This version removes vehicle verification and adds bank-account lookups
 * against src/db/bankAccounts.json with status handling: active/blocked/existing.
 */

import {
  findByAccount,
  findByFull,
  BankAccountRecord,
} from "../db/bankAccountDatabase";

/**
 * Helpers
 */
const ok = (extra: Record<string, unknown> = {}) => ({
  matched: true,
  ...extra,
});

const fail = (message: string, extra: Record<string, unknown> = {}) => ({
  matched: false,
  message,
  ...extra,
});

/**
 * Minimal mock verifiers for non-bank types to keep existing routes working.
 * Adjust/replace with your own logic as needed.
 */

export const verifyEmail = (data: { email?: string }) => {
  if (!data?.email) return fail("Missing email");
  // naive mock
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  return valid ? ok({ email: data.email }) : fail("Invalid email format");
};

export const verifyPhoneNumber = (data: { phoneNumber?: string }) => {
  if (!data?.phoneNumber) return fail("Missing phoneNumber");
  // naive mock E.164-ish digits check
  const digits = String(data.phoneNumber).replace(/\D/g, "");
  return digits.length >= 10 ? ok({ phoneNumber: data.phoneNumber }) : fail("Invalid phone number");
};

export const verifyPostalAddress = (data: {
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}) => {
  const { line1, city, state, postalCode, country } = data || {};
  if (!line1 || !city || !state || !postalCode || !country) {
    return fail("Missing address fields");
  }
  // mock normalization
  return ok({
    address: {
      line1,
      city,
      state,
      postalCode,
      country,
    },
  });
};

export const verifySSN = (data: { ssn?: string }) => {
  if (!data?.ssn) return fail("Missing ssn");
  const digits = String(data.ssn).replace(/\D/g, "");
  return digits.length === 9 ? ok({ ssn: `***-**-${digits.slice(-4)}` }) : fail("Invalid SSN");
};

export const verifyBusinessEntity = (data: { ein?: string; name?: string }) => {
  // very naive EIN format check and presence of name
  const { ein, name } = data || {};
  if (!ein || !name) return fail("Missing ein or name");
  const einDigits = String(ein).replace(/\D/g, "");
  return einDigits.length === 9 ? ok({ ein, name }) : fail("Invalid EIN");
};

/**
 * ---- Bank-specific verification ----
 *
 * verifyBankAccount:
 *   Input expects:
 *     routingNumber, accountNumber, accountHolderName, bankName
 *   Behavior:
 *     - Try full match first (routing+account+name+bank)
 *     - If not found, try match by routing+account only (optional fallback)
 *     - Return status: active | blocked | existing | not_found
 */
export const verifyBankAccount = (data: {
  routingNumber?: string;
  accountNumber?: string;
  accountHolderName?: string;
  bankName?: string;
}) => {
  const routingNumber = data?.routingNumber?.trim();
  const accountNumber = data?.accountNumber?.trim();
  const accountHolderName = data?.accountHolderName?.trim();
  const bankName = data?.bankName?.trim();

  if (!routingNumber || !accountNumber || !accountHolderName || !bankName) {
    return { matched: false, message: "Missing one or more required fields" };
  }

  let record =
    findByFull(routingNumber, accountNumber, accountHolderName, bankName) ||
    findByAccount(routingNumber, accountNumber);

  if (!record) {
    return { matched: false, message: "No matching bank account record found" };
  }

  // If you need to treat “blocked/existing” specially, you can decide to fail:
  if (record.status === "blocked") {
    return { matched: false, message: "This account is blocked" };
  }
  if (record.status === "existing") {
    return { matched: false, message: "This account already exists" };
  }

  // Success (STRICT: no extra props)
  return { matched: true };
};

/**
 * verifyBankAccountOwner:
 *   Confirms the owner name for a given routing+account (and optionally bankName).
 *   Returns matched + ownerMatched boolean and status.
 */

export const verifyBankAccountOwner = (data: {
  routingNumber?: string;
  accountNumber?: string;
  accountHolderName?: string;
  bankName?: string;
}) => {
  const routingNumber = data?.routingNumber?.trim();
  const accountNumber = data?.accountNumber?.trim();
  const accountHolderName = data?.accountHolderName?.trim();
  const bankName = data?.bankName?.trim();

  if (!routingNumber || !accountNumber || !accountHolderName) {
    return { matched: false, message: "Missing one or more required fields" };
  }

  const record =
    (bankName &&
      findByFull(routingNumber, accountNumber, accountHolderName, bankName)) ||
    findByAccount(routingNumber, accountNumber);

  if (!record) {
    return { matched: false, message: "Account not found" };
  }

  const ownerMatched =
    record.accountHolderName.toLowerCase().trim() ===
    accountHolderName.toLowerCase().trim();

  if (!ownerMatched) {
    return { matched: false, message: "Owner mismatch" };
  }

  // Success (STRICT: no extra props)
  return { matched: true };
};

/**
 * Helpers
 */
function redact(record: BankAccountRecord) {
  // Don't return raw account number in responses
  const last4 = record.accountNumber.slice(-4);
  return {
    id: record.id,
    routingNumber: record.routingNumber,
    accountNumber: `********${last4}`,
    accountHolderName: record.accountHolderName,
    bankName: record.bankName,
    status: record.status ?? "active",
  };
}
