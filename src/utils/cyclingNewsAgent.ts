import Parser from 'rss-parser';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { Client } from '@notionhq/client';
import { subDays, isAfter } from 'date-fns';

interface AgentResult {
  success: boolean;
  logs: string[];
  content: string;
}

const RSS_URL = 'https://feeds.nos.nl/nossportwielrennen';

const IGNORED_KEYWORDS = [
  'baanwielrennen',
  'baan',
  'velodrome',
  'teamsprint',
  'keirin',
  'omnium',
  'afvalkoers'
];

export async function runCyclingNewsAgent(daysBack: number): Promise<AgentResult> {
  const logs: string[] = [];
  let generatedContent = '';

  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    log(`Starten met ophalen nieuws (${daysBack} dagen terug)...`);

    // 1. RSS Scrape
    const parser = new Parser();
    const feed = await parser.parseURL(RSS_URL);
    log(`RSS opgehaald: ${feed.items.length} items gevonden.`);

    // 2. Filter Logic
    const cutoffDate = subDays(new Date(), daysBack);
    log(`Cutoff datum: ${cutoffDate.toISOString()}`);

    const filteredItems = feed.items.filter(item => {
      if (!item.isoDate && !item.pubDate) return false;
      const itemDate = new Date(item.isoDate || item.pubDate!);
      
      // Date Filter
      if (!isAfter(itemDate, cutoffDate)) return false;

      // Content Filter (Subject)
      const title = (item.title || '').toLowerCase();
      const snippet = (item.contentSnippet || item.content || '').toLowerCase();
      const fullText = `${title} ${snippet}`;

      const hasIgnoredKeyword = IGNORED_KEYWORDS.some(keyword => fullText.includes(keyword));
      if (hasIgnoredKeyword) {
        return false;
      }

      return true;
    });

    log(`Na filter: ${filteredItems.length} artikelen overgebleven.`);
    
    // DEBUG: Laat zien welke artikelen zijn gevonden
    filteredItems.forEach((item, index) => {
      log(`   [${index + 1}] ${item.title} (${item.isoDate || item.pubDate})`);
    });

    if (filteredItems.length === 0) {
      log('Geen nieuws gevonden.');
      return { success: true, logs, content: 'Geen nieuws gevonden.' };
    }

    // 3. AI Summary (Cerebras)
    log('Artikelen voorbereiden voor Cerebras...');
    const articlesText = filteredItems.map(item => {
      return `Titel: ${item.title}\nDatum: ${item.isoDate || item.pubDate}\nSnippet: ${item.contentSnippet}\nLink: ${item.link}\n---`;
    }).join('\n');

    const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
    const primaryModel = process.env.CEREBRAS_MODEL || 'llama-3.3-70b';
    const fallbackModel = process.env.CEREBRAS_MODEL_FALLBACK;

    if (!cerebrasApiKey) {
      throw new Error('CEREBRAS_API_KEY is missing');
    }

    const client = new Cerebras({
      apiKey: cerebrasApiKey,
    });

    const systemPrompt = `Je bent een gedegen wielrenjournalist, met kennis van alle wielrenkoersen en de geschiedenis van belangrijke wielrenners. 
Maak een uitgebreid en diepgaand verslag. Combineer alle feiten tot een vloeiend verhaal, maar wees zeer gedetailleerd.
Geef context bij de overwinningen, noem de teams, de omstandigheden (zoals weer of parcours) en de impact op het klassement of het seizoen.
Maak het een meeslepend verhaal zonder bullets, paragrafen of titels. 
Voeg artikel verhalen samen die door de tijd gaan over dezelfde koers. Geef ook het datum bereik aan in de titel zodat we weten over welke periode het nieuws gaat. 
maak het compleet en mis absoluut geen enkel detail uit de bronteksten.
Gebruik GEEN markdown opmaak (zoals vetgedrukte tekst met **sterretjes**). Schrijf alleen platte tekst.
De taal MOET Nederlands zijn.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `Hier zijn de artikelen:\n${articlesText}` }
    ];

    const callAI = async (model: string) => {
        log(`Cerebras aan het denken met model ${model}...`);
        const completion: any = await client.chat.completions.create({
            messages: messages,
            model: model,
        });
        return completion.choices[0].message.content;
    };

    try {
        generatedContent = await callAI(primaryModel) || '';
    } catch (error: any) {
        log(`Fout met primair model ${primaryModel}: ${error.message}`);
        if (fallbackModel) {
             log(`Schakelen naar fallback model ${fallbackModel}...`);
             try {
                 generatedContent = await callAI(fallbackModel) || '';
             } catch (fallbackError: any) {
                 throw new Error(`Fallback model faalde ook: ${fallbackError.message}`);
             }
        } else {
            throw error;
        }
    }
    
    log('Cerebras klaar met schrijven.');

    // 4. Notion Storage
    log('Opslaan in Notion...');
    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDbId = process.env.NOTION_DATABASE_ID;

    if (!notionApiKey || !notionDbId) {
      throw new Error('NOTION_API_KEY or NOTION_DATABASE_ID is missing');
    }

    const notion = new Client({ auth: notionApiKey });

    // Chunking content for Notion (max 2000 chars per block)
    const chunks = [];
    for (let i = 0; i < generatedContent.length; i += 2000) {
      chunks.push(generatedContent.substring(i, i + 2000));
    }

    const children = chunks.map(chunk => ({
      object: 'block' as const,
      type: 'paragraph' as const,
      paragraph: {
        rich_text: [
          {
            type: 'text' as const,
            text: {
              content: chunk,
            },
          },
        ],
      },
    }));

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const titleDate = today.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' });

    // Veld 'Omschrijving' (Rich Text) - we gebruiken nu alle chunks om niks te missen
    const descriptionProperty = {
      rich_text: chunks.map(chunk => ({
        text: {
          content: chunk,
        },
      })),
    };

    await notion.pages.create({
      parent: { database_id: notionDbId },
      properties: {
        'Nieuws': {
          title: [
            {
              text: {
                content: `Wielernieuws tm ${titleDate}`,
              },
            },
          ],
        },
        'Datum': {
          date: {
            start: dateStr,
          },
        },
        'Omschrijving': descriptionProperty,
      },
      children: children,
    });

    log('Notion save gelukt!');

    return {
      success: true,
      logs,
      content: generatedContent
    };

  } catch (error: any) {
    log(`Error: ${error.message}`);
    return {
      success: false,
      logs,
      content: generatedContent || 'Er is een fout opgetreden.'
    };
  }
}
