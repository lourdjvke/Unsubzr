import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { openDB } from 'idb';

export interface Post {
  id: string;
  title: string;
  content: string;
  platform: string;
  createdAt: number;
  seriesId?: string;
}

export interface Series {
  id: string;
  title: string;
  createdAt: number;
  originalUrl?: string;
  originalPrompt?: string;
  referenceArticleUrl?: string;
  styleKnowledge?: string;
}

export interface AppState {
  posts: Post[];
  series: Series[];
  systemPrompt: string;
  customApiKey?: string;
}

const DB_NAME = 'spring_writer_db';
const STORE_NAME = 'state';

const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
};

export const loadState = async (): Promise<AppState> => {
  const db = await initDB();
  const saved = await db.get(STORE_NAME, 'state');
  if (saved) {
    return saved;
  }
  return {
    posts: [],
    series: [],
    systemPrompt: 'You are a professional social media content creator. Adapt the user\'s writing to the specified platform while maintaining their unique tone and making it sound as human as possible. \n\nFormatting Rules:\n- For X (Twitter) and Facebook: Provide plain text only. No markdown, no bolding, no headers.\n- For Hashnode: Provide structured markdown with headers, subheaders, and clear formatting.\n- For LinkedIn and Instagram: Use minimal markdown (bolding for emphasis is okay, but no complex headers).',
  };
};

export const saveState = async (state: AppState) => {
  const db = await initDB();
  await db.put(STORE_NAME, state, 'state');
};

export const getAI = (customKey?: string) => {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({ apiKey });
};

export const adaptContent = async (
  content: string,
  platform: string,
  systemPrompt: string,
  customKey?: string
): Promise<string> => {
  const ai = getAI(customKey);
  if (!ai) throw new Error('API Key missing');

  const prompt = `Adapt this content for ${platform}. 
IMPORTANT: Follow the platform formatting rules strictly. 
- If ${platform} is X or Facebook, return ONLY plain text. 
- If ${platform} is Hashnode, return a well-structured technical blog post in Markdown.

Content to adapt:
${content}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
    },
  });

  return response.text || '';
};

export const generateFromUrl = async (
  url: string,
  platform: string,
  isSeries: boolean,
  instructions: string,
  systemPrompt: string,
  customKey?: string,
  isDeepDive?: boolean,
  isNextPart?: boolean,
  seriesTitle?: string,
  referenceArticleUrl?: string
): Promise<{ posts: string[], seriesTitle?: string, styleKnowledge?: string }> => {
  const ai = getAI(customKey);
  if (!ai) throw new Error('API Key missing');
  
  let pageContent = "";
  try {
    const proxyRes = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      pageContent = data.content;
    }
  } catch (e) {
    console.error("Failed to fetch URL content", e);
    pageContent = `Content from URL: ${url}`; // Fallback
  }

  let referenceContent = "";
  if (referenceArticleUrl) {
    try {
      const proxyRes = await fetch(`/api/proxy?url=${encodeURIComponent(referenceArticleUrl)}`);
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        referenceContent = data.content;
      }
    } catch (e) {
      console.error("Failed to fetch reference article", e);
    }
  }

  let prompt = "";
  if (isNextPart) {
    prompt = `Continue the series "${seriesTitle}" for ${platform}. Based on the original content: ${pageContent}. ${instructions ? `Additional instructions for next part: ${instructions}` : ''}.`;
  } else if (isSeries) {
    prompt = `Create a 2-post series for ${platform} based on this content: ${pageContent}. ${instructions ? `Additional instructions: ${instructions}` : ''}. ${isDeepDive ? 'Make it a deep dive: detailed, in-depth, and long.' : ''} ${referenceContent ? `Use the style, formatting, direction, and creative spin of this reference article: ${referenceContent}` : ''} Return the posts separated by "---POST_BREAK---" and start with a title for the series on the first line.`;
  } else {
    prompt = `Create a post for ${platform} based on this content: ${pageContent}. ${instructions ? `Additional instructions: ${instructions}` : ''}. ${isDeepDive ? 'Make it a deep dive: detailed, in-depth, and long.' : ''} ${referenceContent ? `Use the style, formatting, direction, and creative spin of this reference article: ${referenceContent}` : ''}`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
    },
  });

  const text = response.text || '';
  if (isSeries || isNextPart) {
    const lines = text.split('\n');
    const title = lines[0].replace(/^Title:\s*/i, '').trim();
    const posts = lines.slice(1).join('\n').split('---POST_BREAK---').map(p => p.trim());
    return { posts, seriesTitle: title, styleKnowledge: referenceContent };
  } else {
    return { posts: [text] };
  }
};
