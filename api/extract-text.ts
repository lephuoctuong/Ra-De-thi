export default async function handler(req: any, res: any) {
  // 1. Thiết lập CORS cho phép giao diện kết nối
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Kiểm tra API Key từ Vercel
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel.' });
    }

    const { text, fileData, mimeType, prompt } = req.body || {};
    const userPrompt = prompt || "Hãy trích xuất và số hóa toàn bộ nội dung văn bản/tài liệu này một cách chính xác nhất.";

    const parts: any[] = [];
    if (fileData && mimeType) {
      parts.push({
        inline_data: { mime_type: mimeType, data: fileData }
      });
    }
    parts.push({ text: fileData ? userPrompt : `${userPrompt}\n\nNội dung:\n${text || ''}` });

    // 3. Sử dụng các model chuẩn chính thức từ Google Gemini
    const models = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'];
    let lastErrorMessage = '';

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] })
        });

        const data = await response.json();

        if (response.ok) {
          const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          return res.status(200).json({ 
            text: extractedText, 
            result: extractedText,
            success: true 
          });
        }

        lastErrorMessage = data.error?.message || `Model ${model} không phản hồi`;
      } catch (err: any) {
        lastErrorMessage = err.message;
      }
    }

    return res.status(500).json({ error: `Lỗi kết nối Gemini API: ${lastErrorMessage}` });

  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Lỗi máy chủ nội bộ' });
  }
}
