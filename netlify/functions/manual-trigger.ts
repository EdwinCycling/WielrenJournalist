import { Handler } from '@netlify/functions';
import { runCyclingNewsAgent } from '../../src/utils/cyclingNewsAgent';
import 'dotenv/config';

export const handler: Handler = async (event, context) => {
  // Beveiliging: Check of het request van localhost komt of een geldige ADMIN_TOKEN heeft
  const adminToken = process.env.ADMIN_TOKEN;
  const authHeader = event.headers['authorization'];
  
  // Als we op productie zijn (niet localhost), check dan het token
  const isLocal = event.headers.host?.includes('localhost') || event.headers.host?.includes('127.0.0.1');
  
  if (!isLocal && (!adminToken || authHeader !== `Bearer ${adminToken}`)) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  console.log('Manual trigger started...');
  // Days back = 2 (Test mode)
  const result = await runCyclingNewsAgent(2);

  return {
    statusCode: 200,
    body: JSON.stringify({
      logs: result.logs,
      result: result.content,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  };
};
