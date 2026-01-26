import { Handler } from '@netlify/functions';
import { Client } from '@notionhq/client';
import 'dotenv/config';

export const handler: Handler = async (event) => {
  // Beveiliging: Alleen toegang vanaf localhost
  const isLocal = event.headers.host?.includes('localhost') || event.headers.host?.includes('127.0.0.1');
  if (!isLocal) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: Test tools only available on localhost' }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDbId = process.env.NOTION_DATABASE_ID;

  if (!notionApiKey || !notionDbId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: 'Configuratie fout: NOTION_API_KEY of NOTION_DATABASE_ID ontbreekt.' 
      }),
    };
  }

  try {
    const notion = new Client({ auth: notionApiKey });
    
    // Probeer database info op te halen
    const response = await notion.databases.retrieve({ database_id: notionDbId });
    const dbTitle = (response as any).title[0]?.plain_text || 'Naamloze database';
    
    // Haal property namen op
    const properties = Object.keys(response.properties);
    const propertiesList = properties.join(', ');

    // Check of de verwachte kolommen bestaan
    const requiredProps = ['Nieuws', 'Datum', 'Omschrijving'];
    const missingProps = requiredProps.filter(p => !properties.includes(p));

    let message = `Verbinding geslaagd! Database: "${dbTitle}".\nGevonden kolommen: ${propertiesList}.`;
    
    if (missingProps.length > 0) {
      message += `\n⚠️ WAARSCHUWING: De volgende kolommen ontbreken in de database: ${missingProps.join(', ')}. Pas de namen in Notion aan.`;
    } else {
      message += `\n✅ Alle benodigde kolommen zijn aanwezig.`;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: missingProps.length === 0, 
        message: message
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: `Notion Error: ${error.message}` 
      }),
    };
  }
};
