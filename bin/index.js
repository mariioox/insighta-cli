#!/usr/bin/env node
import { Command } from 'commander';
import axios from 'axios';
import Conf from 'conf';
import open from 'open';
import express from 'express';
import { generatePKCE } from '../pkce.js';

const program = new Command();
const config = new Conf({ projectName: 'insighta' });
const BACKEND_URL = 'https://hng-stage-3-backend-pi.vercel.app';

program
  .name('insighta')
  .description('Insighta Labs+ CLI Tool')
  .version('1.0.0');

// --- LOGIN COMMAND ---
program
  .command('login')
  .description('Login via GitHub OAuth with PKCE')
  .action(async () => {
    const { verifier, challenge } = generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');

    // 1. Start temporary local server to catch the code
    const app = express();
    const server = app.listen(4321);

    app.get('/callback', async (req, res) => {
      const { code, state: returnedState } = req.query;

      if (returnedState !== state) {
          return res.send('State mismatch error.');
      }

      try {
        // 2. Exchange code + verifier with your backend
        const response = await axios.post(`${BACKEND_URL}/api/v1/auth/exchange`, {
          code,
          code_verifier: verifier
        });

        // 3. Store tokens locally[cite: 1]
        config.set('accessToken', response.data.tokens.accessToken);
        config.set('refreshToken', response.data.tokens.refreshToken);
        config.set('user', response.data.user);

        res.send('Login successful! You can close this tab.');
        console.log(`✅ Logged in as @${response.data.user.name}`);
        server.close();
        process.exit(0);
      } catch (err) {
        res.send('Login failed.');
        server.close();
      }
    });

    // 4. Open GitHub Auth in browser[cite: 1]
    const authUrl = `https://github.com/login/oauth/authorize?client_id=YOUR_ID&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;
    console.log('Opening browser for authentication...');
    await open(authUrl);
  });

// --- WHOAMI COMMAND ---
program
  .command('whoami')
  .description('Check current user session')
  .action(() => {
    const user = config.get('user');
    if (!user) return console.log('Not logged in.');
    console.log(`Logged in as: ${user.name} (${user.role})`);
  });

program.parse();
