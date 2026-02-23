import { schedule } from '@netlify/functions';
import { runCyclingNewsAgent } from '../../src/utils/cyclingNewsAgent';
import 'dotenv/config';

const myHandler = async () => {
  console.log('Scheduled function started...');
  // Ophalen van nieuws van de laatste 7 dagen (standaard is 6, maar voor de zekerheid iets ruimer)
  const result = await runCyclingNewsAgent(7);
  console.log('Scheduled function finished.');
  console.log(result.logs.join('\n'));
  
  return {
    statusCode: 200,
  };
};

// Every Sunday at 22:00 CET
export const handler = schedule('0 22 * * 0', myHandler);
