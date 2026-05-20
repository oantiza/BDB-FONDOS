const { GoogleGenerativeAI } = require('@google/generative-ai');
const key = process.env.GEMINI_API_KEY;
(async () => {
  if (!key) throw new Error('missing_key');
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Responde solo OK' }] }],
      generationConfig: { temperature: 0 },
    });
    console.log('SDK_TEXT_OK', result.response.text().trim().slice(0, 80));
  } catch (e) {
    console.log('SDK_TEXT_FAIL', e.message, e.cause && (e.cause.code || e.cause.message));
    process.exit(1);
  }
})();
