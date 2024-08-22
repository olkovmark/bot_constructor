import { auth, sheets } from "@googleapis/sheets";
import { drive, drive_v3 } from "@googleapis/drive";

const CREDENTIALS_PATH = "credentials.json";
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

export class GoogleTableAPI {
  static auth;
  static drive;
  static sheets;
  static async init() {
    const authS = new auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: SCOPES,
    });

    this.auth = authS;

    this.drive = drive({ version: "v3", auth: authS });
    this.sheets = sheets({
      version: "v4",
      auth: authS,
    });

    return authS;
  }

  static async create(tableName) {
    try {
      return await this.sheets.spreadsheets.create({
        auth: this.auth,
        requestBody: {
          properties: { title: tableName },
          sheets: [{ properties: { title: "Загальна" } }],
        },
      });
    } catch (error) {
      logger.error(error);
    }
  }

  static async get(tableId) {
    try {
      return (
        await this.sheets.spreadsheets.get({
          auth: this.auth,
          spreadsheetId: tableId,
        })
      ).data;
    } catch (error) {
      console.error(error);
    }
  }

  static async getTable(tableId, range) {
    try {
      return (
        await this.sheets.spreadsheets.values.get({
          spreadsheetId: tableId,
          range,
        })
      ).data;
    } catch (error) {
      console.error(error);
    }
  }

  static async updateTable(tableId, requests) {
    try {
      const requestBody = {
        requests,
      };

      return await this.sheets.spreadsheets.batchUpdate(
        { spreadsheetId: tableId, requestBody },
        {}
      );
    } catch (error) {
      logger.error(error.message);
    }
  }

  static async listTables() {
    try {
      return (await this.drive.files.list()).data.files;
    } catch (error) {
      logger.error(error);
    }
  }

  static async getListDrive() {
    const params = {};
    const res = await this.drive.files.list(params);
  }
}
