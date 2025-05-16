import { sheets, sheetId } from '../config/googleSheets';

export class GoogleSheetsClient {
  private readonly spreadsheetId: string;

  constructor(spreadsheetId?: string) {
    this.spreadsheetId = spreadsheetId || sheetId;
  }

  /**
   * Get data from a sheet in the configured spreadsheet
   * @param sheetName The name of the sheet to read from
   * @param range Optional range (e.g., "A1:D10")
   * @returns Array of row data
   */
  async getSheetData(sheetName: string, range?: string): Promise<any[][]> {
    try {
      // When only sheetName is provided, default to sheetName!A1:Z100 for a reasonable default range
      // This ensures we're using a valid range format for the API
      const rangeDef = range ? `${sheetName}!${range}` : `${sheetName}!A1:Z100`;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: rangeDef,
      });

      return response.data.values || [];
    } catch (error: unknown) {
      // Check if this is a "sheet not found" type error
      const errorMessage = error instanceof Error ? error.message : String(error) || '';
      const isSheetNotFound =
        errorMessage.includes('not found') ||
        errorMessage.includes('does not exist') ||
        errorMessage.includes('Unable to parse range');

      if (isSheetNotFound) {
        console.warn(
          `Sheet "${sheetName}" not found or not accessible. This might be expected if the sheet is being created.`,
        );
        return []; // Return empty array instead of throwing
      }

      console.error('Error fetching sheet data:', error);
      throw new Error(`Failed to fetch data from sheet "${sheetName}": ${error}`);
    }
  }

  /**
   * Update data in a sheet
   * @param sheetName The name of the sheet to update
   * @param range The range to update (e.g., "A1:D10")
   * @param values The values to write
   */
  async updateSheetData(sheetName: string, range: string, values: any[][]): Promise<void> {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
    } catch (error) {
      console.error('Error updating sheet data:', error);
      throw new Error(`Failed to update data in sheet "${sheetName}": ${error}`);
    }
  }

  /**
   * Append data to a sheet
   * @param sheetName The name of the sheet to append to
   * @param values The values to append
   */
  async appendSheetData(sheetName: string, values: any[][]): Promise<void> {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
        },
      });
    } catch (error) {
      console.error('Error appending sheet data:', error);
      throw new Error(`Failed to append data to sheet "${sheetName}": ${error}`);
    }
  }

  /**
   * Get all sheets in the spreadsheet
   */
  async getSheets(): Promise<string[]> {
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      return (response.data.sheets || [])
        .map((sheet) => sheet.properties?.title || '')
        .filter(Boolean);
    } catch (error) {
      console.error('Error fetching sheets:', error);
      throw new Error(`Failed to fetch sheets: ${error}`);
    }
  }

  /**
   * Create a new sheet in the spreadsheet
   * @param sheetName The name of the new sheet
   */
  async createSheet(sheetName: string): Promise<void> {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });
      console.log(`Sheet "${sheetName}" created successfully.`);
    } catch (error) {
      console.error('Error creating sheet:', error);
      throw new Error(`Failed to create sheet "${sheetName}": ${error}`);
    }
  }
}
