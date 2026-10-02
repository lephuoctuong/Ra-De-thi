/**
 * Validation helpers for user-provided source documents.
 *
 * IMPORTANT: extraction fallback/error messages must never become business data.
 * This validator is shared by the browser and the server.
 */

const EXTRACTION_FALLBACK_PATTERNS = [
  'có vẻ như bạn chưa cung cấp',
  'có vẻ như chưa có nội dung',
  'bạn chưa cung cấp hình ảnh',
  'bạn chưa cung cấp nội dung',
  'chưa cung cấp hình ảnh',
  'chưa cung cấp nội dung',
  'vui lòng tải lên hình ảnh',
  'vui lòng tải lên tệp',
  'vui lòng tải lên tài liệu',
  'vui lòng gửi hình ảnh',
  'vui lòng gửi tệp',
  'vui lòng gửi tài liệu',
  'không có nội dung để trích xuất',
  'không thể trích xuất nội dung',
  'không thể đọc nội dung tài liệu',
  'không đọc được nội dung tài liệu',
  'lỗi số hóa tệp',
  'gặp lỗi khi số hóa tệp',
  'không thể khởi tạo',
];

const normalizeForValidation = (text: string) =>
  text
    .replace(/^\uFEFF/, '')
    .replace(/\*+/g, '')
    .replace(/[_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Detects the generic fallback returned by the old extraction/chat flow.
 * We deliberately combine signals instead of relying on one exact sentence,
 * because Gemini may paraphrase the same message.
 */
export const isExtractionFallback = (text: string): boolean => {
  if (typeof text !== 'string') return true;

  const head = normalizeForValidation(text.slice(0, 2500));
  if (!head) return false;

  // Exact/common variants.
  if (EXTRACTION_FALLBACK_PATTERNS.some((pattern) => head.includes(pattern))) return true;

  // Paraphrased variants such as:
  // "Bạn chưa cung cấp nội dung văn bản hoặc hình ảnh tài liệu cần trích xuất."
  const missingSource = /chưa\s+cung\s+cấp|chưa\s+có\s+nội\s+dung|không\s+có\s+nội\s+dung/;
  const extractionAction = /trích\s+xuất|số\s+hóa|xử\s+lý\s+tài\s+liệu/;
  const uploadAction = /tải\s+lên|gửi\s+(?:hình\s+ảnh|tệp|tài\s+liệu)|dán\s+(?:nội\s+dung|văn\s+bản)/;

  if (missingSource.test(head) && (extractionAction.test(head) || uploadAction.test(head))) return true;

  // Typical assistant-style fallback: "Tôi sẽ giúp bạn..." after asking for a file.
  if (/tôi\s+sẽ\s+giúp\s+bạn/.test(head) && (uploadAction.test(head) || extractionAction.test(head))) return true;

  // Markdown/chat variants that explicitly ask the user to provide source data.
  if (/bạn\s+(?:vui\s+lòng|hãy)\s+(?:tải\s+lên|gửi|dán)/.test(head) && extractionAction.test(head)) return true;

  return false;
};

/** Returns true when text is real source content rather than an extraction fallback/error. */
export const isValidSourceText = (text: string, minLength = 1): boolean => {
  if (typeof text !== 'string') return false;

  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (trimmed.length < minLength) return false;
  return !isExtractionFallback(trimmed);
};

/** Returns a safe source value; invalid extraction/fallback text becomes empty. */
export const sanitizeSourceText = (text: string, minLength = 1): string => {
  if (typeof text !== 'string') return '';
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  return isValidSourceText(cleaned, minLength) ? cleaned : '';
};

/** Stricter check for data returned by /api/extract-text. */
export const isValidExtractedText = (text: string): boolean =>
  isValidSourceText(text, 30);

export const EXTRACTION_INVALID_MESSAGE =
  'Không trích xuất được nội dung hợp lệ từ tài liệu. Thầy/Cô vui lòng kiểm tra lại tệp hoặc dán trực tiếp nội dung vào ô nhập.';
