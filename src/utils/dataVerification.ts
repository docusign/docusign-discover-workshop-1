import {
  findByOpeningFull,
  findByRoutingAccount,
  BankAccountRecord,
} from "../db/bankAccountDatabase";

const ok = () => ({ matched: true } as const);
const fail = (message: string) => ({ matched: false as const, message });

export const verifyBankAccountOpening = (data: {
  routingNumber?: string;
  accountNumber?: string;
  accountHolderName?: string;
  bankName?: string;
  status?: string;
}) => {
  const routingNumber = data?.routingNumber?.trim();
  const accountNumber = data?.accountNumber?.trim();
  const accountHolderName = data?.accountHolderName?.trim();
  const bankName = data?.bankName?.trim();

  if (!routingNumber || !accountNumber || !accountHolderName || !bankName) {
    return fail("Missing one or more required fields: routingNumber, accountNumber, accountHolderName, bankName");
  }

  let record: BankAccountRecord | undefined = findByOpeningFull(
    routingNumber,
    accountNumber,
    accountHolderName,
    bankName
  );

  if (!record) {
    record = findByRoutingAccount(routingNumber, accountNumber);
  }

  if (!record) return fail("No matching bank account record found");

  if (record.status === "blocked") return fail("This account is blocked");
  if (record.status === "existing") return fail("This account already exists");

  return ok();
};
