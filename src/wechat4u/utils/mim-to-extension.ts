interface MimeToExtensionMap {
  [key: string]: string;
}

const mimeToExtension: MimeToExtensionMap = {
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/tiff': 'tiff',
  'image/webp': 'webp',
  // eslint-disable-next-line sort-keys
  'image/svg+xml': 'svg',
}

export function getExtensionFromMimeType (mimeType: string): string | undefined {
  return mimeToExtension[mimeType]
}
