/**
 * Validates that a Google Sheet has the expected headers
 */
export function validateSheetHeaders(
  headerRow: string[],
  requiredHeaders: string[],
  sheetName: string,
): void {
  // Check if all required headers exist
  const missingHeaders = requiredHeaders.filter((header) => !headerRow.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(
      `Sheet "${sheetName}" is missing required headers: ${missingHeaders.join(', ')}`,
    );
  }
}

/**
 * Finds the column index for a given header
 */
export function getColumnIndex(headerRow: string[], header: string): number {
  const index = headerRow.indexOf(header);
  if (index === -1) {
    throw new Error(`Column "${header}" not found in header row`);
  }
  return index;
}

/**
 * Maps a row from Google Sheets into an object based on headers
 */
export function mapRowToObject(row: string[], headerRow: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  headerRow.forEach((header, index) => {
    result[header] = index < row.length ? row[index] : '';
  });

  return result;
}
