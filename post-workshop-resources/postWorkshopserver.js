'use strict';

// Rename this to server.js after you've completed the workshop to see the full version.

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
// console.log('Loaded settings from settings.txt');
// console.log('Account ID:', process.env.DS_ACCOUNT_ID);

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
  const { code, state } = req.query || {};
  if (!code) return res.status(400).send('Missing ?code=');

  if (!state || state !== req.session.oauthState) {
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

// Trigger workflow function
app.get("/trigger", async (req, res) => {
  const token = req.session.accessToken;
  if (!token) return res.redirect("/login");

  try {
    const accountId = process.env.DS_ACCOUNT_ID;
    const workflowId = process.env.MAESTRO_WORKFLOW_ID;

    const client = new iam.IamClient({ accessToken: token });

    // Retrieve trigger requirements
    // Comment this out if you don't want to fetch requirements first
    const requirements = await client.maestro.workflows.getWorkflowTriggerRequirements({
      accountId,
      workflowId,
    });

    console.log("Trigger Requirements:");
    console.log(JSON.stringify(requirements, null, 2));
    // End retrieve trigger requirements

    const triggerInputs = {
      startDate: "2024-10-30",
    };

    const triggerWorkflowPayload = {
      instanceName: "Raileen's Super Cool Workflow",
      triggerInputs,
    };

    // Debugging helper - uncomment to verify values
    // console.log("Workflow ID:", workflowId);
    // console.log("Trigger inputs:", JSON.stringify(triggerWorkflowPayload, null, 2));

    // Call the Maestro triggerWorkflow API via the SDK
    const result = await client.maestro.workflows.triggerWorkflow({
      accountId,
      workflowId,
      triggerWorkflow: triggerWorkflowPayload,
    });

    // Debugging helper -uncomment to verify response
    // console.log("Response: ");
    // console.log(JSON.stringify(result, null, 2));

    const instanceUrl = result?.instanceUrl;

    res
      .status(200)
      .type("html")
      .send(`
        <h2>Workflow Instance Triggered! Yay!</h2><pre>${JSON.stringify(result, null, 2)}</pre>
        <p><strong>Instance URL:</strong> <a href="${instanceUrl}" target="_blank">${instanceUrl}</a></p>
        <iframe 
          src="${instanceUrl}" 
          width="100%" 
          height="800px" 
          style="border:1px solid #ccc; border-radius:8px;">
        </iframe>
    <hr>
    <h3>Full Response</h3>
    <pre>${JSON.stringify(result, null, 2)}</pre>
        `);

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
  console.error("Running on: ");
  console.log(`http://localhost:${port}`);
});
