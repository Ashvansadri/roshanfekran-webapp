const { defineConfig } = require('@playwright/test');
module.exports=defineConfig({
 testDir:'./e2e',
 timeout:30000,
 retries:1,
 workers:1,
 use:{
  baseURL:'http://127.0.0.1:4173',
  browserName:'chromium',
  screenshot:'on',
  trace:'retain-on-failure',
 },
 reporter:'line',
});
