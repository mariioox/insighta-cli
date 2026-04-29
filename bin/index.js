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

const generatePKCE = () => {
  const verifier = crypto.randomBytes(32).toString('hex');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

program
  .name('insighta')
  .description('Insighta Labs+ CLI')
  .version('1.0.0');

// --- LOGIN ---
program
  .command('login')
  .action(async () => {
    const { verifier, challenge } = generatePKCE();
    const state = crypto.randomBytes(16).toString('hex');
    const app = express();
    const server = app.listen(4321);

    app.get('/callback', async (req, res) => {
      try {
        const response = await axios.post(`${BACKEND_URL}/api/v1/auth/exchange`, {
          code: req.query.code,
          code_verifier: verifier
        });

        config.set('accessToken', response.data.tokens.accessToken);
        config.set('user', {
          // Catch name or username or fallback
          name: response.data.user.name || response.data.user.username || 'User',
          role: response.data.user.role
        });

        res.send('<h1>Success!</h1>');
        console.log(`\n✅ Logged in as ${config.get('user').name}`);
        server.close(() => process.exit(0));
      } catch (err) {
        res.send('<h1>Failed</h1>');
        server.close(() => process.exit(1));
      }
    });

    const GITHUB_CLIENT_ID = '36fc35c2080bf82eb89f'; 
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&state=${state}`;
    console.log('Opening browser...');
    await open(authUrl);
  });

// --- WHOAMI ---
program
  .command('whoami')
  .action(() => {
    const user = config.get('user');
    if (!user) return console.log('Not logged in.');
    console.log(`Logged in as: ${user.name} | Role: ${user.role}`);
  });

// --- LIST ---
program
  .command('profiles:list')
  .action(async () => {
    const token = config.get('accessToken');
    const resp = await axios.get(`${BACKEND_URL}/api/v1/profiles`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-API-Version': '1' }
    });
    console.table(resp.data.data);
  });

// --- SEARCH (Ensure this is EXACTLY like this) ---
program
  .command('profiles:search <query>')
  .description('Natural language search')
  .action(async (query) => {
    const token = config.get('accessToken');
    if (!token) return console.log('Login first.');
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/v1/profiles/search`, {
        params: { q: query },
        headers: { 'Authorization': `Bearer ${token}`, 'X-API-Version': '1' }
      });
      console.table(resp.data.data);
    } catch (err) {
      console.error('Search failed:', err.response?.data?.message || err.message);
    }
  });

// --- EXPORT ---
program
  .command('profiles:export')
  .action(async () => {
    const token = config.get('accessToken');
    const resp = await axios.get(`${BACKEND_URL}/api/v1/profiles/export`, {
      params: { format: 'csv' },
      headers: { 'Authorization': `Bearer ${token}`, 'X-API-Version': '1' },
      responseType: 'arraybuffer'
    });
    fs.writeFileSync(`export_${Date.now()}.csv`, resp.data);
    console.log('Exported!');
  });

// CRITICAL: MUST BE AT THE VERY END
program.parse();
