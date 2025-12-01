import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TOKEN = process.env.TOKEN || process.env.ADMIN_TEST_TOKEN;
const QUESTION_ID = process.env.QUESTION_ID;

if (!TOKEN) {
  console.error('Missing TOKEN env. Example: TOKEN=eyJ... QUESTION_ID=<id> npm run ai:test');
  process.exit(1);
}
if (!QUESTION_ID) {
  console.error('Missing QUESTION_ID env. Provide a valid Mongo ObjectId of a question.');
  process.exit(1);
}

async function main() {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN}`,
  };
  try {
    // Status
    const sRes = await fetch(`${BASE_URL}/ai/status`, { headers });
    let sBody: any = null;
    try { sBody = await sRes.json(); } catch { sBody = await sRes.text(); }
    console.log('AI /status:', sRes.status);
    if (typeof sBody === 'object') {
      const { provider, model, baseUrl, hasToken } = sBody || {};
      console.log('  provider:', provider);
      console.log('  model:', model);
      console.log('  baseUrl:', baseUrl, '| hasToken:', Boolean(hasToken));
    } else {
      console.log('  raw:', sBody);
    }

    // Explain
    const eRes = await fetch(`${BASE_URL}/ai/explain`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: QUESTION_ID, userAnswer: [0], lang: 'fr' }),
    });
    let eBody: any = null;
    try { eBody = await eRes.json(); } catch { eBody = await eRes.text(); }
    console.log('AI /explain:', eRes.status);
    if (typeof eBody === 'object') {
      const preview = (eBody?.explanation || '').slice(0, 160).replace(/\s+/g, ' ');
      console.log('  model:', eBody?.model, '| cached:', Boolean(eBody?.cached));
      console.log('  explanation length:', (eBody?.explanation || '').length);
      console.log('  preview:', preview);
    } else {
      console.log('  raw:', eBody);
    }
  } catch (err: any) {
    console.error('AI smoke test failed:', err?.message || err);
    process.exit(2);
  }
}

main();

