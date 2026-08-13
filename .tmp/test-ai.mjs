import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const r = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [{ role: 'user', parts: [{ text: 'Create a dark moody luxury watch store homepage' }] }],
  config: {
    systemInstruction: 'You are a senior e-commerce web designer. Plan ONE turn. Return ONLY JSON: {"reply": string, "action": "chat"|"generate_page"|"edit_page", "plannedPages": [{"id","label","type","path"}], "targetPage": null|{...}}',
    temperature: 0.7,
    responseMimeType: 'application/json',
  },
});
console.log('TEXT:', JSON.stringify(r.text).slice(0, 500));
