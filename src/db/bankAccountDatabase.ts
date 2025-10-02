import fs from "fs";
import path from "path";

export interface BankAccountRecord {
  id: string;
  routingNumber: string;
  accountNumber: string;
  accountHolderName: string;
  bankName: string;
  status?: "active" | "blocked" | "existing";
}

const JSON_PATH = path.join(__dirname, "bankAccounts.json");

let bankAccounts: BankAccountRecord[] = [];

(function load() {
  try {
    const raw = fs.readFileSync(JSON_PATH, "utf-8");
    bankAccounts = JSON.parse(raw) as BankAccountRecord[];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to load bankAccounts.json:", err);
    bankAccounts = [];
  }
})();

export const getBankAccounts = (): BankAccountRecord[] => bankAccounts;

export const findByAccount = (
  routingNumber: string,
  accountNumber: string
): BankAccountRecord | undefined => {
  return bankAccounts.find(
    (rec) =>
      rec.routingNumber === routingNumber && rec.accountNumber === accountNumber
  );
};

export const findByFull = (
  routingNumber: string,
  accountNumber: string,
  accountHolderName: string,
  bankName: string
): BankAccountRecord | undefined => {
  return bankAccounts.find(
    (rec) =>
      rec.routingNumber === routingNumber &&
      rec.accountNumber === accountNumber &&
      rec.accountHolderName.toLowerCase().trim() ===
        accountHolderName.toLowerCase().trim() &&
      rec.bankName.toLowerCase().trim() === bankName.toLowerCase().trim()
  );
};
