#!/usr/bin/env node
import { Command } from 'commander';
import axios from 'axios';
import Conf from 'conf';
import open from 'open';
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';

const program = new Command();
const config = new Conf({ projectName: 'insighta' });
const BACKEND_URL = 'https://hng-stage-3-backend-pi.vercel.app';

// PKCE Utility: Required by STAGE 3 TASK - TRD
const generatePKCE = () => {
  const verifier = crypto.randomBytes(32).toString('hex');
  const challenge = crypto.createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
};

program
  .name('insighta')
  .description('Insighta Labs+ Secure CLI')
  .version('1.0.0');

// --- LOGIN COMMAND ---
program
  .command('login')
  .description('Login via GitHub OAuth with PKCE')
  .action(async () => {
    const { verifier, challenge } = generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');
    const app = express();
    const server = app.listen(4321);

    app.get('/callback', async (req, res) => {
      const { code, state: returnedState } = req.query;
      if (returnedState !== state) return res.send('State mismatch error.');

      try {
        const response = await axios.post(`${BACKEND_URL}/api/v1/auth/exchange`, {
          code,
          code_verifier: verifier
        });

        config.set('accessToken', response.data.tokens.accessToken);
        config.set('refreshToken', response.data.tokens.refreshToken);
        config.set('user', response.data.user);

        res.send('<h1>Login Successful!</h1><p>You can close this tab and return to your terminal.</p>');
        console.log(`\n✅ Logged in as @${response.data.user.name}`);
        server.close();
        process.exit(0);
      } catch (err) {
        res.send('Login failed.');
        console.error('❌ Exchange failed:', err.response?.data || err.message);
        server.close();
        process.exit(1);
      }
    });

    const authUrl = `https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&state=${state}&scope=user:email`;
    console.log('Opening browser for authentication...');
    await open(authUrl);
  });

// --- LIST PROFILES ---
program
  .command('profiles:list')
  .description('List profiles with filters and pagination[cite: 1]')
  .option('-g, --gender <gender>', 'Filter by gender')
  .option('-c, --country <country>', 'Filter by country ID')
  .option('--page <number>', 'Page number', '1')
  .action(async (options) => {
    const token = config.get('accessToken');
    if (!token) return console.log('❌ Please login first: insighta login');

    try {
      const resp = await axios.get(`${BACKEND_URL}/api/v1/profiles`, {
        params: options,
        headers: { 'Authorization': `Bearer ${token}`, 'X-API-Version': '1' }
      });
      console.table(resp.data.data.map(p => ({ Name: p.name, Age: p.age, Country: p.country_id })));
      console.log(`Page ${resp.data.page} of ${resp.data.total_pages}`);
    } catch (err) {
      console.error('❌ Error:', err.response?.data?.message || err.message);
    }
  });

// --- EXPORT PROFILES (Admin Only) ---
program
  .command('profiles:export')
  .description('Export profiles to CSV (Admin only)[cite: 1]')
  .action(async () => {
    const token = config.get('accessToken');
    try {
      console.log('Generating CSV export...');
      const resp = await axios.get(`${BACKEND_URL}/api/v1/profiles/export`, {
        params: { format: 'csv' },
        headers: { 'Authorization': `Bearer ${token}`, 'X-API-Version': '1' },
        responseType: 'arraybuffer'
      });

      const filename = `profiles_${Date.now()}.csv`;
      fs.writeFileSync(filename, resp.data);
      console.log(`✅ File saved to: ./${filename}`);
    } catch (err) {
      const msg = err.response?.status === 403 ? "Forbidden: Admin access only[cite: 1]" : err.message;
      console.error('❌ Export failed:', msg);
    }
  });

// --- WHOAMI ---
program
  .command('whoami')
  .description('Display current session info[cite: 1]')
  .action(() => {
    const user = config.get('user');
    if (!user) return console.log('Not logged in.');
    console.log(`Logged in as: ${user.name} | Role: ${user.role}`);
  });

program.parse();
