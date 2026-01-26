import { runCyclingNewsAgent } from './src/utils/cyclingNewsAgent.ts';
import 'dotenv/config';

async function test() {
  console.log('--- START DIRECTE TEST (2 dagen terug) ---');
  const result = await runCyclingNewsAgent(2);
  
  console.log('\n--- LOGS ---');
  result.logs.forEach(log => console.log(log));
  
  console.log('\n--- GEMINI OUTPUT ---');
  console.log(result.content);
  
  if (result.success) {
    console.log('\n✅ Test succesvol afgerond.');
  } else {
    console.log('\n❌ Test mislukt.');
  }
}

test();
