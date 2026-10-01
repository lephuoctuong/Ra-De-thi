export default async function handler(req: any, res: any) {
  // 1. Thiết lập CORS
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
    // 2. Lấy Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel.' });
    }

    const { text, fileData, mimeType, prompt } = req.body || {};
    const userPrompt = prompt || "Hãy trích xuất và số hóa toàn bộ nội dung văn bản/tài liệu này một cách chính xác nhất.";

    // 3. Đường dẫn API cập nhật sang model gemini-2.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const parts: any[] = [];
    
    if (fileData && mimeType) {
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: fileData
        }
      });
    }
    
    parts.push({ text: fileData ? userPrompt : `${userPrompt}\n\nNội dung:\n${text || ''}` });

    // 4. Gửi yêu cầu tới Google Gemini
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Lỗi khi gọi Gemini API' });
    }

    const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // 5. Trả kết quả về cho giao diện
    return res.status(200).json({ 
      text: extractedText, 
      result: extractedText,
      success: true 
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Lỗi máy chủ nội bộ' });
  }
}
