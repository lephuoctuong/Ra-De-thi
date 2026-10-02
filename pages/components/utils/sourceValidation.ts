/**
 * Validation helpers for user-provided source documents.
 *
 * The application must never treat an extraction error/fallback message as
 * an actual lesson or regulation source. This module is intentionally free of
 * browser/Node-specific APIs so it can be shared by the React client and the
 * server extraction endpoint.
 */

const EXTRACTION_FALLBACK_PATTERNS = [
  'có vẻ như bạn chưa cung cấp',
  'có vẻ như chưa có nội dung',
  'bạn chưa cung cấp hình ảnh',
  'bạn chưa cung cấp nội dung',
  'bạn vui lòng tải lên hình ảnh',
  'bạn vui lòng tải lên tệp',
  'vui lòng tải lên hình ảnh',
  'vui lòng tải lên tệp',
  'vui lòng tải lên tài liệu',
  'chưa cung cấp hình ảnh',
  'chưa cung cấp nội dung văn bản',
  'chưa cung cấp nội dung cần trích xuất',
  'nội dung cần trích xuất',
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
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Returns true when text is non-empty and does not look like an extraction fallback/error. */
export const isValidSourceText = (text: string, minLength = 1): boolean => {
  if (typeof text !== 'string') return false;

  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (trimmed.length < minLength) return false;

  // Only inspect the beginning: a real document may legitimately contain
  // phrases such as "vui lòng tải lên..." later in its body.
  const head = normalizeForValidation(trimmed.slice(0, 1200));
  return !EXTRACTION_FALLBACK_PATTERNS.some((pattern) => head.includes(pattern));
};

/** Stricter check for data returned by /api/extract-text. */
export const isValidExtractedText = (text: string): boolean =>
  isValidSourceText(text, 30);

export const EXTRACTION_INVALID_MESSAGE =
  'Không trích xuất được nội dung hợp lệ từ tài liệu. Thầy/Cô vui lòng kiểm tra lại tệp hoặc dán trực tiếp nội dung vào ô nhập.';
