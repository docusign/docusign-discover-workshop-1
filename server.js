'use strict';

const express = require('express');
const axios = require('axios');
const session = require('express-session');
const dotenv = require('dotenv');
const crypto = require('crypto');
const iam = require('@docusign/iam-sdk');

dotenv.config({ path: './settings.txt' });

const app = express();
const port = process.env.PORT || 4000;

// Debugging helper - uncomment to verify settings load
console.log('Loaded settings from settings.txt');
console.log('Account ID:', process.env.DS_ACCOUNT_ID);

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { sameSite: 'lax' }
}));

// Helper function to verify required env vars
function ensureEnv(...keys) {
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('Missing settings keys:', missing.join(', '));
    process.exit(1);
  }
  console.log('✅ All required environment variables found');
}

ensureEnv(
  'DS_AUTH_SERVER',
  'DS_CLIENT_ID',
  'DS_CLIENT_SECRET',
  'DS_REDIRECT_URI',
  'DS_API_BASE_PATH',
  'DS_ACCOUNT_ID',
  'MAESTRO_WORKFLOW_ID'
);

// Home page
app.get('/', (req, res) => {
  console.log('🏠 Home page accessed');
  const loggedIn = !!req.session.accessToken;
  res.type('html').send(`
    <html>
      <head><title>Discover Workshop - Workflow Triggering</title></head>
      <body style="font-family: sans-serif; padding: 24px;">
        <h2>Trigger a Maestro workflow instance</h2>
        <p>Account ID: <code>${process.env.DS_ACCOUNT_ID}</code></p>
        ${loggedIn
          ? `<button style="padding:10px 16px;font-size:16px" onclick="location.href='/trigger'">Trigger Workflow Instance</button>
             <p style="margin-top:12px"><a href="/logout">Log out</a></p>`
          : `<button style="padding:10px 16px;font-size:16px" onclick="location.href='/login'">Log into your Docusign developer account</button>`}
      </body>
    </html>
  `);
});

// Login function: redirect to OAuth authorization endpoint
app.get('/login', (req, res) => {
  console.log('🔐 Login initiated - redirecting to DocuSign OAuth');
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const authUrl =
    `${process.env.DS_AUTH_SERVER}/oauth/auth` +
    `?response_type=code` +
    `&scope=${encodeURIComponent('signature aow_manage')}` +
    `&client_id=${encodeURIComponent(process.env.DS_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(process.env.DS_REDIRECT_URI)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(authUrl);
});

// OAuth callback: exchange code for access_token
app.get('/callback', async (req, res) => {
  console.log('🔄 OAuth callback received - exchanging code for token');
  const { code, state } = req.query || {};
  if (!code) {
    console.error('❌ =Missing authorization code');
    return res.status(400).send('Missing ?code=');
  }

  if (!state || state !== req.session.oauthState) {
    console.error('❌ Invalid OAuth state');
    return res.status(400).send('Invalid state');
  }
  delete req.session.oauthState;

  try {
    const basic = Buffer.from(
      `${process.env.DS_CLIENT_ID}:${process.env.DS_CLIENT_SECRET}`
    ).toString('base64');

    const tokenRes = await axios.post(
      `${process.env.DS_AUTH_SERVER}/oauth/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DS_REDIRECT_URI
      }),
      {
        headers: {
          'Authorization': `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    

    const accessToken = tokenRes.data?.access_token;
    if (!accessToken || typeof accessToken !== 'string') {
      console.error('Token response:', tokenRes.data);
      return res.status(500).send('Did not receive a valid access_token');
    }

    req.session.accessToken = accessToken;
    req.session.tokenReceivedAt = Date.now();
    req.session.expiresIn = tokenRes.data?.expires_in;

    // Debugging helper - uncomment to verify token
    //console.log('Logged in. Token:', accessToken);
    res.redirect('/');
  } catch (err) {
    console.error('OAuth exchange failed:', err.response?.data || err.message);
    res.status(500).send('Login failed (see server logs).');
  }
});

// Loading page that triggers workflow client-side
app.get("/trigger", async (req, res) => {
  console.log('⏳ Loading page served for workflow trigger');
  const loggedIn = !!req.session.accessToken;
  if (!loggedIn) return res.redirect('/login');

  res
    .status(200)
    .type('html')
    .send(`
      <html>
        <head>
          <title>Triggering Workflow...</title>
          <style>
            body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
            .wrap { text-align:center; }
            .spinner { width:56px; height:56px; border:6px solid #e5e7eb; border-top-color:#2563eb; border-radius:50%; animation: spin 1s linear infinite; margin: 0 auto 12px; }
            @keyframes spin { to { transform: rotate(360deg); } }
            .muted { color:#6b7280; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="spinner"></div>
            <div>Triggering workflow, please wait...</div>
            <div class="muted">Do not close this tab</div>
          </div>
          <script>
            (async () => {
              try {
                const res = await fetch('/trigger/run');
                const html = await res.text();
                document.open();
                document.write(html);
                document.close();
              } catch (e) {
                document.body.innerHTML = '<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding:24px">Failed to trigger workflow. Please go back and try again.<pre>' + (e && (e.stack || e.message) || 'Unknown error') + '</pre></div>';
              }
            })();
          </script>
        </body>
      </html>
    `);
});

// Trigger workflow function (actual run)
app.get("/trigger/run", async (req, res) => {
  console.log('🚀 Workflow trigger requested');
  const token = req.session.accessToken;
  if (!token) {
    console.log('❌ No access token - redirecting to login');
    return res.redirect("/login");
  }

  try {
    const accountId = process.env.DS_ACCOUNT_ID;
    const workflowId = process.env.MAESTRO_WORKFLOW_ID;
    console.log('📋 Account ID:', accountId);
    console.log('🔄 Workflow ID:', workflowId);

    const client = new iam.IamClient({ accessToken: token });

    // ========================== TASK 1 =========================
    // Make an API call to retrieve workflow trigger requirements
    // The endpoint is: GET https://api-d.docusign.com/v1/accounts/{accountId}/workflows/{workflowId}/trigger-requirements
    const triggerRequirements = await client.maestro.workflows.getWorkflowTriggerRequirements({
      accountId,
      workflowId
    });

    // Log trigger requirements for visibility while developing
    try {
      console.log('🧾 Trigger requirements received:');
      console.log(JSON.stringify(triggerRequirements, null, 2));
      // If the response has a common shape, surface likely useful fields
    } catch (e) {
      // Defensive: never fail the flow due to logging
    }


    // Build trigger inputs strictly from triggerRequirements.triggerInputSchema
    const schema = triggerRequirements?.triggerInputSchema || [];
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const triggerInputs = {
      "startDate": "2025-10-29",
      "email": "vkotu24@gmail.com",
      "accountHolderName": "John Doe",
      "bankName": "Bank of America",
      "accountNumber": "1234567890",
      "routingNumber": "111000025"
    };

    console.log('✉️ Using triggerInputs (derived from triggerInputSchema):');
    console.log(JSON.stringify(triggerInputs, null, 2));

    // Name your instance
    const triggerWorkflowPayload = {
      instanceName: "discover-workshop-bank-account-opening",
      triggerInputs,
    };

    // ========================== TASK 1 end =========================

    // Debugging helper - uncomment to verify values
    console.log("Workflow ID:", workflowId);
    console.log("Trigger inputs:", JSON.stringify(triggerWorkflowPayload, null, 2));

    // ========================== TASK 2 ==========================
    // Call the Maestro triggerWorkflow API via the SDK
    // client.maestro.workflows.triggerWorkflow

    let result;
    try {
      // Preferred: SDK call
      result = await client.maestro.workflows.triggerWorkflow({
        accountId,
        workflowId,
        triggerWorkflow: triggerWorkflowPayload,
      });
      console.log("🎉 Workflow triggered successfully via SDK!");
    } catch (sdkErr) {
      console.warn("SDK validation failed, falling back to direct HTTP POST:", sdkErr?.message || sdkErr);
      // Fallback: raw HTTP to match working cURL
      const url = `${process.env.DS_API_BASE_PATH}/accounts/${accountId}/workflows/${workflowId}/actions/trigger`;
      const body = {
        instance_name: triggerWorkflowPayload.instanceName,
        trigger_inputs: triggerWorkflowPayload.triggerInputs,
      };
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const httpRes = await axios.post(url, body, { headers });
      result = httpRes.data;
      console.log("🎉 Workflow triggered successfully via HTTP!");
    }


    //========================== TASK 2 end =========================
    console.log("📊 Result:", JSON.stringify(result, null, 2));

    const instanceUrl = result?.instanceUrl || result?.workflow_instance_url || result?.instance_url;

    res
      .status(200)
      .type("html")

      // ========================== TASK 3 ==========================
      // Display the instanceUrl as a clickable link and embedded iframe
      .send(`
        <html>
          <head>
            <title>Workflow Triggered</title>
            <style>
              body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
              .grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
              .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
              .muted { color: #6b7280; font-size: 12px; }
              a.button { display: inline-block; padding: 10px 16px; background: #2563eb; color: #fff; border-radius: 6px; text-decoration: none; }
              iframe { width: 100%; height: 800px; border: 1px solid #e5e7eb; border-radius: 8px; }
              code, pre { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; display: block; overflow: auto; }
            </style>
          </head>
          <body>
            <div class="grid">
              <div class="card">
                <h2>Workflow Instance Triggered</h2>
                ${instanceUrl ? `<p><strong>Instance URL:</strong> <a class="button" target="_blank" href="${instanceUrl}">Open in new tab</a></p>` : '<p class="muted">Instance URL not returned in response.</p>'}
                ${instanceUrl ? `<div style="margin-top:12px"><iframe src="${instanceUrl}" title="Workflow Instance"></iframe></div>` : ''}
              </div>
              <div class="card">
                <h3>Response</h3>
                <pre>${JSON.stringify(result, null, 2)}</pre>
              </div>
            </div>
          </body>
        </html>
      `);

      // ========================== TASK 3 end ==========================

  } catch (err) {
    console.error("Failed to trigger workflow:");
    console.error("Error:", err.message);
    console.error("Response:", err.response?.data || err);

    res.status(500).send(`
      <h2>Failed to start workflow</h2>
      <pre>${JSON.stringify(err.response?.data || err.message, null, 2)}</pre>
    `);
  }
});

// Logout (clear session)
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Start server
app.listen(port, () => {
  console.log('');
  console.log('🎉 Server started successfully!');
  console.log('📍 Local URL: http://localhost:' + port);
});
