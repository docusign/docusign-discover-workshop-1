# Discover Workshop — Bank Account Opening

Building the Connected Fields extension app.

---

## Prerequisites

Before the workshop, ensure you have:

- Docusign developer account (signup link: https://developers.docusign.com/)
- Node.js and npm
- ngrok (or Cloudflared as backup)
- Optional: Docker Desktop (useful if ngrok is blocked)

## 1. Clone the repository

```bash
git clone https://github.com/docusign/docusign-discover-workshop-1.git
```

---

## 2. Add sample data

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

## 3. Generate secret values

Run this command **four** times and save each value:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'));"
```

You will use these values in the next step.

---

## 4. Set environment variables

- Copy `example.development.env` to `development.env`.
- Replace the following values with your generated secrets:
  - `JWT_SECRET_KEY`
  - `OAUTH_CLIENT_ID`
  - `OAUTH_CLIENT_SECRET`
  - `AUTHORIZATION_CODE`

---

## 5. Install dependencies

```bash
npm install
```

---

## 6. Run the proxy server

```bash
npm run dev
```

This starts a local server on the port defined in `development.env` (default: `3000`).

---

## 7. Start ngrok (or Cloudflared)

Start ngrok to expose localhost:

```bash
ngrok http 3000
```

If ngrok is blocked or assigns problematic `.dev` domains, you can run it via Docker:

```bash
docker run -it -e NGROK_AUTHTOKEN=<YOUR_AUTH_TOKEN> ngrok/ngrok http host.docker.internal:3000
```

Optional: Use Cloudflared (macOS/Homebrew example)

Install Homebrew (if needed):

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Install cloudflared:

```bash
brew install cloudflared
```

Start a Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

You can also download cloudflared from the official installation guide.

---

## 8. Save the forwarding address

Copy the forwarding address from ngrok/cloudflared output — you will use this in the manifest.

Example ngrok output excerpt (for reference):

```
Session Status                online
Forwarding                    https://bbd7-12-202-171-35.ngrok-free.app -> http://localhost:3000
Web Interface                 http://127.0.0.1:4040
```

---

## 9. Prepare your app manifest

In `manifest.json`:

- Replace `<PROXY_BASE_URL>` with your ngrok/cloudflared forwarding address in:
  - `connections.params.customConfig.tokenUrl`
  - `connections.params.customConfig.authorizationUrl`
  - `actions.params.uri` (for all actions)

- Replace these client values with generated values from step 3:
  - `clientId` → `OAUTH_CLIENT_ID` (development.env)
  - `clientSecret` → `OAUTH_CLIENT_SECRET` (development.env)

(lines referenced in the source manifest: clientId ~ line 23, clientSecret ~ line 24)

---

## 10. Upload your manifest and create the Bank Account Registration app

- Go to Docusign Developer Console: https://devconsole.docusign.com/apps
- Create App → By editing the manifest.
- Paste or upload `manifest.json` and select Validate → Create App.

---

## 11. Console tests

- Open the new app → App Testing → Install app.
- Run the connection test (click Run Test → Visit site → consent).
- Run `getTypeNames` (default request body).
- Run `getTypeDefinitions` (default request body) — returns large declarations object.

Verify extension tests — example request bodies and expected responses below.

Testing success (should verify):

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

Testing blocked account (should fail with blocked reason):

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

Testing not-found (guaranteed failure):

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

# Building the Maestro workflow

## Web Form Template (create in Docusign web forms)

1. Go to: https://apps-d.docusign.com/send/forms  
   Click Start → Web Forms → Create Web Form
2. Choose “Start from scratch” → Next
3. Name the web form (e.g., “Bank Account Details”) → Apply
4. Configure pages and add fields. Add these Text Fields (required):
   - Email (API reference name: `email`)
   - Account Holder Name (API reference name: `accountHolderName`)
   - Bank Name (API reference name: `bankName`)
   - Account Number (API reference name: `accountNumber`)
   - Routing Number (API reference name: `routingNumber`)
5. Save → Activate. Set Access setting to “Public” → Activate.

---

## Envelope Template

1. Go to: https://apps-d.docusign.com/send/templates  
   Start → Envelope Templates → Create a Template
2. Fill Template Name (e.g., “New Account Registration”), add `Account Registration Form - DocuCo.pdf` from repository.
3. Add a recipient role (e.g., “Account Holder” — leave name/email blank).
4. Envelope Types → Select “Bank Account Opening Agreements”.
5. In the Document Editor:
   - Switch to “Custom Fields” → App Fields → expand your uploaded app (e.g., “Bank Account Opening”).
   - Drag and place the app fields (Account Holder Name, Account Number, Bank Name, Routing Number) onto the PDF.
   - For each field, enable “Must verify to sign” under Data Verification.
   - Optionally rename Data Label to readable names (e.g., `accountNumber`).
   - Add Signature and Date Signed standard fields.
6. Save and Close → confirm template appears in “My Templates”.

---

## Maestro Workflow Creation

1. Go to: https://apps-d.docusign.com/send/workflows → Create Workflow → New Canvas → Continue
2. Add workflow start → “From an API call” → Next
3. Add Text variables:
   - `email`
   - `accountHolderName`
   - `bankName`
   - `accountNumber`
   - `routingNumber`
   Click Next → choose “Human” for starter → Apply
4. Add step: Collect Data with Web Forms
   - Configure: select the web form (“Bank Account Details”)
   - Add Participant → role: “Account Holder”
   - Map workflow variables to form fields → Apply
5. Add step: Prepare eSignature Template
   - Configure: select the envelope template (“New Account Registration”)
   - Map template fields to the Web Form values → Apply
6. Add step: Send Documents for Signature
   - Choose prepared template → Use a direct signing session
   - Map recipient name/email to Web Form values (Account Holder name/email)
   - Apply
7. Add step: Show a Confirmation Screen
   - Participant: Account Holder
   - Message title: “Account Registration Submitted”
   - Message body: “Thank you for submitting the Account Registration form. Please inform us if you want to withdraw this in the future.”
   - Apply
8. Add path end node → Review & Publish
   - Set workflow name: “Account Registration Flow”
   - Fix any validation errors, then Publish
   - Authorize application senders if prompted

---

## Testing the Maestro Workflow

1. Go to: https://apps-d.docusign.com/send/workflows
2. Locate your published workflow → Run Workflow
3. On “Start this flow manually” enter required fields and click Start
4. A new tab opens the web form. Fill with test data (blocked example):

- Email: <your email>
- Account Holder Name: Jane Smith
- Bank Name: Chase Bank
- Account Number: 9876543210
- Routing Number: 222000111

5. Submit the form → complete signing; you should see validation errors if using blocked data. Replace with valid data (example success):

- Account Holder Name: John Doe
- Bank Name: Bank of America
- Account Number: 1234567890
- Routing Number: 111000025

6. Complete signing → confirm workflow success on the confirmation screen.

---

# Trigger a workflow instance using the Maestro API

## Create integration key and configure settings

1. Go to Docusign Developer Center: https://developers.docusign.com/ → Log in
2. Profile → My Apps and Keys → Add App and Integration Key
3. Save:
   - Integration Key
   - Add Secret Key (save)
4. Under Additional settings → Redirect URIs add:
   - http://localhost:4000
   - http://localhost:4000/callback
   Save.

5. Copy from Apps and Keys page:
   - User ID
   - API Account ID
6. In Maestro Workflows (Agreements → Maestro Workflows) find your published workflow and copy the workflow ID from the URL.

7. Rename `example.settings.txt` to `settings.txt` and update values:

```
DS_CLIENT_ID=YOUR_INTEGRATION_KEY
DS_CLIENT_SECRET=YOUR_SECRET
DS_ACCOUNT_ID=PASTE_YOUR_API_ACCOUNT_ID
MAESTRO_WORKFLOW_ID=YOUR_WORKFLOW_ID
```

---

## Complete the code tasks

Open `server.js` and find the `/trigger` route. Three tasks:

- TASK 1 — Get trigger requirements & set inputs
- TASK 2 — Trigger the workflow
- TASK 3 — Show the instance URL and embed it in an iframe

Helpful resources:
- Maestro code example (sample code for finding trigger requirements, triggering the workflow, and embedding)
- API: getWorkflowTriggerRequirements
- API: triggerWorkflow

Hint: Pay attention to required fields for the request body.

---

## Trigger the workflow locally

Start the trigger server:

```bash
npm run trigger
```

Open: http://localhost:4000  
Click “Log into your Docusign developer account” → grant consent → you’ll be redirected back and see your Account ID and a Trigger button. Click “Trigger Workflow Instance” to display the instance URL and embedded iframe.

---

Feel free to repeat tests, modify the forms/templates/workflow, and experiment with more sample data.
