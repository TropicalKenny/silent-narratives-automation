import fs from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import { getSecret } from './secrets.js';

const model = 'gemini-3.8-flash';

function cleanMarkdown(s='') {
  return String(s).replace(/\*\*/g,'').trim();
}

export function parsePackage(raw='') {
  const text = String(raw);
  const take = (n, next) => {
    const end = next ? '(?=\\n---\\s*\\n\\s*###\\s*' + next + '\\.)' : '$';
    const re = new RegExp('###\\s*' + n + '\\.[^\\n]*\\n([\\s\\S]*?)' + end, 'i');
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  const hook = cleanMarkdown(take(1,2));
  const title = cleanMarkdown(take(2,3));
  const description = take(3,4).trim();
  const tags = take(4,null).replace(/\x60\x60\x60text|\x60\x60\x60/gi,'').trim();
  return { hook, title, description, tags };
}

export async function analyzeYouTube(url) {
  const apiKey = getSecret('gemini_api_key');
  if (!apiKey) throw new Error('Gemini API key is not configured.');
  const prompt = fs.readFileSync('config/master_prompt.md','utf8');
  const client = new GoogleGenAI({ apiKey });

  const interaction = await client.interactions.create({
    model,
    input: [
      { type: 'text', text: prompt },
      { type: 'video', uri: url }
    ],
    generation_config: { thinking_level: 'high' }
  });

  const raw = interaction.outputText || interaction.output_text || (interaction.outputs || []).map(x => x.text || (x.content || []).map(y => y.text || '').join('')).join('') || '';
  const pkg = parsePackage(raw);
  if (!pkg.hook || !pkg.title) throw new Error('Gemini returned an unexpected package format.');

  const scenePrompt = [
    'Analyze the same video for production automation.',
    'Return ONLY valid JSON with these keys:',
    'movie_or_show, year, scene_description, visible_action, subtitle_mode, subtitle_text, edit_note.',
    'subtitle_text must be a short array of at most 2 concise on-screen lines.',
    'Do not invent facts. If uncertain, use null and explain uncertainty in edit_note.'
  ].join(' ');

  const sceneInteraction = await client.interactions.create({
    model,
    input: [
      { type: 'text', text: scenePrompt },
      { type: 'video', uri: url }
    ],
    generation_config: { thinking_level: 'medium' }
  });

  let sceneMeta = {};
  const sceneRaw = (sceneInteraction.outputText || sceneInteraction.output_text || (sceneInteraction.outputs || []).map(x => x.text || (x.content || []).map(y => y.text || '').join('')).join('') || '')
    .trim()
    .replace(/^\x60\x60\x60json\s*/i,'')
    .replace(/\x60\x60\x60$/,'')
    .trim();
  try { sceneMeta = JSON.parse(sceneRaw); }
  catch { sceneMeta = { edit_note: sceneRaw }; }

  return { ...pkg, raw, sceneMeta };
}
