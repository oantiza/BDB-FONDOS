const { GoogleGenerativeAI } = require('@google/generative-ai');
const key = process.env.GEMINI_API_KEY;
const prompt = process.argv[2] || 'Responde solo OK';
const parallel = Number(process.argv[3] || '1');
async function one(i) {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });
  return result.response.text().slice(0, 80);
}
(async () => {
  if (!key) throw new Error('missing_key');
  try {
    const out = await Promise.all(Array.from({ length: parallel }, (_, i) => one(i)));
    console.log('SDK_TEST_OK', out.length, out[0]);
  } catch (e) {
    console.log('SDK_TEST_FAIL', e.message, e.cause && (e.cause.code || e.cause.message));
    process.exit(1);
  }
})();
