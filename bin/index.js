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

program
  .name('insighta')
  .description('Insighta Labs+ CLI')
  .version('1.0.0');

// --- LOGIN ---
program
  .command('login')
  .action(async () => {
    const state = crypto.randomBytes(16).toString('hex');
    const app = express();
    const server = app.listen(4321, () => {
        console.log('Waiting for GitHub response on port 4321...');
    });

    app.get('/callback', async (req, res) => {
      const { code } = req.query;

      try {
        // We send the code to your backend exchange endpoint
        const response = await axios.post(`${BACKEND_URL}/api/v1/auth/exchange`, {
          code
        });

        // Store user and tokens
        config.set('accessToken', response.data.tokens.accessToken);
        config.set('user', {
          name: response.data.user.name || response.data.user.username || 'User',
          role: response.data.user.role
        });

        res.send('<h1>Login Successful!</h1><p>Return to your terminal.</p>');
        console.log(`\n✅ Authenticated as: ${config.get('user').name}`);
        
        server.close(() => process.exit(0));
      } catch (err) {
        res.send('<h1>Login Failed</h1>');
        console.error('❌ Backend Exchange Error:', err.response?.data || err.message);
        server.close(() => process.exit(1));
      }
    });

    const GITHUB_CLIENT_ID = 'Ov23liS6un3QBW4mSs3e'; 
    // Simplified URL (Standard OAuth)
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&state=${state}&scope=user:email`;
    
    console.log('Opening browser for authentication...');
    await open(authUrl);
  });

// --- WHOAMI ---
program
  .command('whoami')
  .action(() => {
    const user = config.get('user');
    if (!user) return console.log('Not logged in. Run: insighta login');
    console.log(`Logged in as: ${user.name} | Role: ${user.role}`);
  });

// --- LIST ---
program
  .command('profiles:list')
  .action(async () => {
    const token = config.get('accessToken');
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/v1/profiles`, {
        headers: { 'Authorization': `Bearer ${token}`, 'X-API-Version': '1' }
      });
      console.table(resp.data.data.map(p => ({ Name: p.name, Age: p.age, Country: p.country_id })));
    } catch (err) {
      console.error('❌ List failed:', err.response?.data?.message || err.message);
    }
  });

// --- SEARCH ---
program
  .command('profiles:search <query>')
  .action(async (query) => {
    const token = config.get('accessToken');
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/v1/profiles/search`, {
        params: { q: query },
        headers: { 'Authorization': `Bearer ${token}`, 'X-API-Version': '1' }
      });
      console.table(resp.data.data.map(p => ({ Name: p.name, Gender: p.gender, Age: p.age })));
    } catch (err) {
      console.error('❌ Search failed:', err.response?.data?.message || err.message);
    }
  });

// --- EXPORT ---
program
  .command('profiles:export')
  .action(async () => {
    const token = config.get('accessToken');
    try {
      const resp = await axios.get(`${BACKEND_URL}/api/v1/profiles/export`, {
        params: { format: 'csv' },
        headers: { 'Authorization': `Bearer ${token}`, 'X-API-Version': '1' },
        responseType: 'arraybuffer'
      });
      const filename = `export_${Date.now()}.csv`;
      fs.writeFileSync(filename, resp.data);
      console.log(`✅ Saved to ${filename}`);
    } catch (err) {
      console.error('❌ Export failed:', err.response?.status === 403 ? 'Admin only' : err.message);
    }
  });

program.parse();
