# Discover Workshop - Bank account registration

## Introduction
TBD.

To test this reference implementation, modify the `manifest.json` file.

## Local setup instructions

### 1. Clone the repository
Run the following command to clone the repository: 
```bash
git clone https://github.com/docusign/docusign-discover-workshop-1.git
```

### 2. Generate secret values
- If you already have values for `JWT_SECRET_KEY`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, and `AUTHORIZATION_CODE`, you may skip this step.

The easiest way to generate a secret value is to run the following command:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'));"
```

You will need values for `JWT_SECRET_KEY`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, and `AUTHORIZATION_CODE`.

### 3. Set the environment variables for the cloned repository
- If you're running this in a development environment, create a copy of `example.development.env` and save it as `development.env`.
- If you're running this in a production environment, create a copy of `example.production.env` and save it as `production.env`.
- Replace `JWT_SECRET_KEY`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, and `AUTHORIZATION_CODE` in `development.env` or `production.env` with your generated values. These values will be used to configure the sample proxy's mock authentication server. 
- Set the `clientId` value in the manifest file to the same value as `OAUTH_CLIENT_ID`.
- Set the `clientSecret` value in the manifest file to the same value as `OAUTH_CLIENT_SECRET`.
### 4. [Install and configure Node.js and npm on your machine.](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
### 5. Install dependencies
Run the following command to install the necessary dependencies:
```bash
npm install
```
### 6. Running the proxy server
Start the proxy server in development mode by running the command:
```bash
npm run dev
```

This will create a local server on the port in the `development.env` file (port 3000 by default) that listens for local changes that trigger a rebuild.

## Setting up ngrok
### 1. [Install and configure ngrok for your machine.](https://ngrok.com/docs/getting-started/)
### 2. Start ngrok
Run the following command to create a publicly accessible tunnel to your localhost:

```bash
ngrok http <PORT>
```

Replace `<PORT>` with the port number in the `development.env` or `production.env` file.

### 3. Save the forwarding address
Copy the `Forwarding` address from the response. You’ll need this address in your manifest file.

```bash
ngrok                                                    

Send your ngrok traffic logs to Datadog: https://ngrok.com/blog-post/datadog-log

Session Status                online
Account                       email@domain.com (Plan: Free)
Update                        update available (version 3.3.1, Ctrl-U to update)
Version                       3.3.0
Region                        United States (us)
Latency                       60ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://bbd7-12-202-171-35.ngrok-free.app -> http:

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

In this example, the `Forwarding` address to copy is `https://bbd7-12-202-171-35.ngrok-free.app`.
## Create an extension app
### 1. Prepare your app manifest
In the `manifest.json` file, replace `<PROXY_BASE_URL>` with the ngrok forwarding address in the following sections:
- `connections.params.customConfig.tokenUrl`
- `connections.params.customConfig.authorizationUrl`
- `actions.params.uri`
    * Replace this value for all of the actions.

### 2. Navigate to the [Developer Console](https://devconsole.docusign.com/apps)
Log in with your Docusign developer credentials. You can sign up for a free developer account [here](https://www.docusign.com/developers/sandbox).

### 3. Upload your manifest and create the Bank Account Registration app
To [create your extension app](https://developers.docusign.com/extension-apps/build-an-extension-app/create/), select **Create App > By editing the manifest**. In the app manifest editor that opens, upload your manifest file or paste into the editor itself; then select **Validate**. Once the editor validates your manifest, select **Create App.** 

### 4. Console tests
The Developer Console offers extension tests to verify that a connected fields extension app can connect to and exchange data with third-party APIs (or an API proxy that in turn connects with those APIs). 

#### Verify extension test
The `typeName` property in the sample input maps to the name of a concept in the `model.cto` file. Any valid concept name can be used in this field.

The `idempotencyKey` property in the sample input can be left as is.

The `data` property in the sample input are the key-value pairs of the properties of the `typeName` that is being verified, where the key is the name of the property within the concept, and the value is the input to verify. For example, if the concept is defined as:

```
@VerifiableType
@Term("Bank Account Opening")
concept BankAccountOpening {
  @IsRequiredForVerifyingType
  @Term("Routing Number")
  o String routingNumber regex=/^\d{9}$/

  @IsRequiredForVerifyingType
  @Term("Account Number")
  o String accountNumber regex=/^[0-9a-zA-Z]+$/

  @IsRequiredForVerifyingType
  @Term("Account Holder Name")
  o String accountHolderName

  @IsRequiredForVerifyingType
  @Term("Bank Name")
  o String bankName

  @Term("Status")
  o String status optional
}
```

Then the Verify request body would be:
```
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


Running the Verify test with the example request body above should return the following properties in the response:
```
{
"verified":true
"verifyResponseMessage":"Verification succeeded"
}
```
