Discover Workshop - Bank account opening

# Discover Workshop - Bank account opening

This README describes how to build, run, and test the connected fields extension app used in the Discover workshop.

---

## Table of contents

- Overview
- Prerequisites
- Clone the repo
- Add test data
- Generate secret values
- Configure environment & manifest
- Install dependencies
- Run the proxy server
- Start ngrok (local tunnel)
- Save forwarding address
- Prepare and upload manifest
- Console tests
- Build Maestro workflow
  - Web form template
  - Envelope template
  - Maestro workflow creation
  - Testing the Maestro workflow
- Trigger a workflow instance using the Maestro API
- Complete code tasks
- Start the trigger server

---

## Overview

This project demonstrates a Docusign extension app that verifies bank-account information and integrates with Maestro workflows (web forms + eSignature). Follow the steps below to run locally and validate the app.

---

## Prerequisites

- Docusign developer account (free): https://developers.docusign.com/
- Node.js and npm installed
- ngrok installed (or Docker Desktop to run ngrok in a container)
- Optional: Docker Desktop if your environment blocks ngrok

A QR code (or link) to the repository is available in the workshop materials.

---

## 1) Clone the repository

Run:

```bash
git clone https://github.com/docusign/docusign-discover-workshop-1.git
cd docusign-discover-workshop-1
```

---

## 2) Add data

Add entries to `src/db/bankAccount.json`. Example entry:

```json
{
  "id": "5",
  "routingNumber": "443980657",
  "accountNumber": "1122334444",
  "accountType": "checking",
  "accountHolderName": "Discover Workshop",
  "bankName": "CitiBank",
  "status": "active"
}
```

Add as many entries as you like.

---

## 3) Generate secret values

Generate secure random values (you need four distinct values):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'));"
```

Save four generated strings for the next step.

---

## 4) Set environment variables for the cloned repo

1. Copy `example.development.env` to `development.env`.
2. Replace these values in `development.env` with your generated values:
   - `JWT_SECRET_KEY`
   - `OAUTH_CLIENT_ID`
   - `OAUTH_CLIENT_SECRET`
   - `AUTHORIZATION_CODE`
3. In `manifest.json`:
   - Set `clientId` to the same value as `OAUTH_CLIENT_ID`.
   - Set `clientSecret` to the same value as `OAUTH_CLIENT_SECRET`.

---

## 5) Install dependencies

```bash
npm install
```

---

## 6) Run the proxy server

Start the dev server:

```bash
npm run dev
```

Default port is the one set in `development.env` (3000 by default).

This creates a local server that rebuilds on changes.

---

## 7) Start ngrok

Create a publicly accessible tunnel to your localhost:

```bash
ngrok http <PORT>
```

Replace `<PORT>` with the port from `development.env` (e.g., `3000`).

If you need to run ngrok from a Docker container (replace `<YOUR_AUTH_TOKEN>`):

```bash
docker run -it -e NGROK_AUTHTOKEN=<YOUR_AUTH_TOKEN> ngrok/ngrok http host.docker.internal:3000
```

---

## 8) Save the forwarding address

From the ngrok output, copy the Forwarding address (https://...). You will use it in the manifest.

Example ngrok output snippet:

```
Session Status                online
Account                       email@domain.com (Plan: Free)
Version                       3.3.0
Region                        United States (us)
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://bbd7-12-202-171-35.ngrok-free.app -> http://localhost:3000
```

Save the https forwarding URL.

---

## 9) Prepare your app manifest

In `manifest.json`, replace `<PROXY_BASE_URL>` with the ngrok forwarding address in these locations:

- `connections.params.customConfig.tokenUrl`
- `connections.params.customConfig.authorizationUrl`
- `actions.params.uri`

Replace for all actions.

---

## 10) Upload your manifest and create the Bank Account Registration app

1. Go to the Developer Console.
2. Select "Create App" → "By editing the manifest".
3. Paste or upload `manifest.json` in the manifest editor and click "Validate".
4. Click "Create App" after validation.

---

## 11) Console tests

- For the connection test: click the "Click me to consent" button to grant consent.
- Run `getTypeNames` (empty body `{}`) — expected response:

```json
{
  "typeNames": [
    {
      "typeName": "BankAccountOpening",
      "label": "Bank Account Opening"
    }
  ]
}
```

- Run `getTypeDefinitions` with the provided request body — response should include the declarations object from `model.cto`.

Verify extension tests — example request bodies and responses:

1) Guaranteed success (record found)

Request:

```json
{
  "typeName": "BankAccountOpening",
  "idempotencyKey": "mock-bank-open-001",
  "data": {
    "routingNumber": "111000025",
    "accountNumber": "1234567890",
    "accountHolderName": "John Doe",
    "bankName": "Bank of America"
  }
}
```

Response:

```json
{
  "verified": true,
  "verifyResponseMessage": "Verification succeeded"
}
```

2) Blocked account

Request:

```json
{
  "typeName": "BankAccountOpening",
  "idempotencyKey": "mock-bank-open-001",
  "data": {
    "routingNumber": "222000111",
    "accountNumber": "9876543210",
    "accountHolderName": "Jane Smith",
    "bankName": "Chase Bank"
  }
}
```

Response:

```json
{
  "verified": false,
  "verifyResponseMessage": "Verification failed",
  "verifyFailureReason": "This account is blocked"
}
```

3) Guaranteed failure (no record)

Request:

```json
{
  "typeName": "BankAccountOpening",
  "idempotencyKey": "mock-bank-open-001",
  "data": {
    "routingNumber": "111000022",
    "accountNumber": "1234567890",
    "accountHolderName": "John Doe",
    "bankName": "Bank of America"
  }
}
```

Response:

```json
{
  "verified": false,
  "verifyResponseMessage": "Verification failed",
  "verifyFailureReason": "No matching bank account record found"
}
```

---

## Building the Maestro workflow

### Web Form Template Creation

1. Go to: https://apps-d.docusign.com/send/forms
2. Start → Web Forms → Create Web Form.
3. Choose "Start from scratch" → Next.
4. Name your web form (example: "Bank Account Details") → Apply.
5. Customize the Welcome page (title, subtitle) as desired.
6. Add fields (click + below title → Text Field) and set properties:

- Email
  - Field name: Email
  - Required: enabled
  - API reference name: `email`
- Account Holder Name
  - Field name: Account Holder Name
  - Required: enabled
  - API reference name: `accountHolderName`
- Bank Name
  - Field name: Bank Name
  - Required: enabled
  - API reference name: `bankName`
- Account Number
  - Field name: Account Number
  - Required: enabled
  - API reference name: `accountNumber`
- Routing Number
  - Field name: Routing Number
  - Required: enabled
  - API reference name: `routingNumber`

7. Optionally update the Thank You page.
8. Save and Activate the form. Set Access to "Public" and Activate.

---

### Envelope Template Creation

1. Go to: https://apps-d.docusign.com/send/templates
2. Start → Envelope Templates → Create a Template.
3. Fill template info:
   - Template Name: e.g., "Bank Draft Authorization"
   - Description: optional
4. Add document: upload `Bank Draft Authorization Form - DocuCo.pdf` (found in the repo).
5. Add recipient role: e.g., "Account Holder" (leave name/email blank).
6. Envelope Types → Select "Other" → input "Charge Authorization".
7. Switch to "Custom Fields" → "App Fields" → expand your uploaded app (e.g., "Bank Account Opening").
8. Drag the app fields (Account Holder Name, Account Number, Bank Name, Routing Number) onto the PDF. Size and place as required.
9. For each field, enable "Must verify to sign" under Data Verification and set Data Label appropriately.
10. Add standard fields: Signature and Date Signed.
11. Save and Close; the template appears under "My Templates".

---

### Maestro Workflow Creation

1. Go to: https://apps-d.docusign.com/send/workflows
2. Click "Create Workflow" → "New Canvas" → Continue.
3. Add workflow start:
   - Start trigger: "From an API call" → Next.
   - Skip variables (optional) → Next.
   - Select "Human" for who starts the API call → Apply.
4. Add step: "Collect Data with Web Forms" → Configure:
   - Select the web form you created (e.g., "Bank Account Details").
   - Add participant role "Account Holder".
   - Map data fields: choose "Enter manually" and set the keys: `email`, `accountHolderName`, `bankName`, `accountNumber`, `routingNumber`.
   - Apply.
5. Add step: "Prepare eSignature Template" → Configure:
   - Select the template you created (e.g., "Bank Draft Authorization").
   - Map Template Field Mappings to the Web Forms fields (Account Holder Name → Account Holder Name, etc.).
   - Apply.
6. Add step: "Send Documents for Signature" → Configure:
   - Choose document: "Prepare eSignature Template" → Prepared eSignature Template.
   - Choose "Use a direct signing session".
   - Map recipient fields using "Collect Data with Web Forms" (Account Holder Name, Email).
   - Apply.
7. Add step: "Show a Confirmation Screen" → Configure:
   - Participant: Account Holder
   - Message type: Write Custom Message
   - Message title: "Bank Draft Authorization Submitted"
   - Message body: "Thank you for submitting the Bank Draft Authorization form. Please inform us if you want to withdraw this authorization in the future."
   - Apply.
8. Add step: "Add a Path End" → Finish flow graph.
9. Click "Review & Publish":
   - Workflow name: "Bank Draft Authorization Flow"
   - Fix any validation errors if present.
   - Click Publish (you may need to authorize application senders).
   - After publishing, click "Go to Workflows".

---

## Testing the Maestro Workflow

1. Go to: https://apps-d.docusign.com/send/workflows
2. Locate your published workflow and copy the workflow initiative URL (link icon).
3. Paste the workflow URL into a fresh browser tab (or use "Run Workflow" from the menu).
4. Flow begins with the web form. Fill with test data (use blocked account to see verification):

Example blocked data:
- Email: your email
- Account Holder Name: Jane Smith
- Bank Name: Chase Bank
- Account Number: 9876543210
- Routing Number: 222000111

5. Proceed to Summary → Submit.
6. A signing session will open. Click Continue, then Start → Fill In fields.
7. If verification fails (e.g., "This account is blocked"), you cannot finish. Update the form with valid data to proceed.

Example valid data:
- Account Holder Name: John Doe
- Bank Name: Bank of America
- Account Number: 1234567890
- Routing Number: 111000025

8. Finish signing; you should be redirected to the confirmation screen if successful.

---

## Trigger a workflow instance using the Maestro API

### Create your integration key and configure settings

1. Go to: https://developers.docusign.com/ and log into your demo account.
2. Top-right → profile picture → My Apps and Keys → Add App and Integration Key.
3. Name your app → Save the Integration Key (client ID).
4. Generate a secret key (Add Secret Key) → Save this secret.
5. Under Additional settings → Redirect URIs, add:
   - `http://localhost:4000`
   - `http://localhost:4000/callback`
6. Save.
7. On the Apps and Keys page, copy and save:
   - User ID
   - API Account ID
8. Select the Agreements tab → Maestro Workflows → find the published workflow → copy the Workflow ID from the URL.

### Update local settings file

1. Rename `example.settings.txt` to `settings.txt`.
2. Replace values:

```
DS_CLIENT_ID=YOUR_INTEGRATION_KEY
DS_CLIENT_SECRET=YOUR_SECRET
DS_ACCOUNT_ID=PASTE_YOUR_API_ACCOUNT_ID
MAESTRO_WORKFLOW_ID=YOUR_WORKFLOW_ID
```

Save the file.

---

## Complete the code tasks

Open `server.js` and find the `/trigger` route. There are three tasks to implement:

- TASK 1 — Get trigger requirements & set inputs
- TASK 2 — Trigger the workflow via Maestro API
- TASK 3 — Show the instance URL and embed it in an iframe

Implement these tasks according to comments and the SDK/examples provided in the repo.

---

## Trigger the workflow (local test)

Start the trigger server:

```bash
npm run trigger
```

Open: http://localhost:4000

1. Click "Log into your Docusign developer account" and grant consent.
2. After redirect, you will see your Account ID and a "Trigger" button.
3. Click "Trigger Workflow Instance". The instance URL should be displayed and embedded in an iframe.