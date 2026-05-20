const { GoogleGenerativeAI } = require('@google/generative-ai');
const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.log('GEMINI_MINIMAL_FAIL missing_key');
  process.exit(2);
}
(async () => {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Responde solo OK' }] }],
      generationConfig: { temperature: 0 },
    });
    const text = result.response.text().trim();
    console.log(text.toUpperCase().includes('OK') ? 'GEMINI_MINIMAL_OK' : 'GEMINI_MINIMAL_UNEXPECTED');
  } catch (error) {
    console.log('GEMINI_MINIMAL_FAIL', error && (error.code || error.message || String(error)));
    process.exit(1);
  }
})();
