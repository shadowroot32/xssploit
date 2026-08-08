import { defineCommand, runMain } from 'citty';
import { scanCommand } from './commands/scan.js';
import { payloadCommand } from './commands/payload.js';
import { callbackCommand } from './commands/callback.js';

const main = defineCommand({
  meta: {
    name: 'xssploit',
    version: '5.0.0',
    description: 'XSSPLOIT Personal Edition — authorized XSS hunting toolkit',
  },
  subCommands: {
    scan: scanCommand,
    payload: payloadCommand,
    callback: callbackCommand,
  },
});

runMain(main);
