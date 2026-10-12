import { webcrypto } from 'node:crypto';
import { ApiResponse, StylesResponse } from '../types/api';
import CryptoKey = webcrypto.CryptoKey;
import { config } from '../config/constants';

export class apiService {
  private static pluginApi: unknown = null;
  private static readonly STORAGE_PREFIX = 'flowly_';
  static readonly BASE_URL = config.baseUrl;
  private static readonly IV_LENGTH = 16;
  private static encryptionKey: CryptoKey | null = null;

  static initialize(pluginApi: unknown): void {
    this.pluginApi = pluginApi;
  }

  static isInitialized(): boolean {
    return this.pluginApi !== null;
  }

  static getDefaultStyles(): StylesResponse {
    return this.defaultStyles;
  }

  private static defaultStyles: StylesResponse = {
    id: 'default',
    name: 'Default Theme',
    company: {
      primaryColor: '#0F70D7',
      background: {
        type: 'solid',
        color: '#06172A',
      },
      logo: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUzNSIgaGVpZ2h0PSIzODgiIHZpZXdCb3g9IjAgMCAxNTM1IDM4OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTU0NS4wNjIgODQuMDMxM0M1NDEuODY2IDg4LjI0ODQgNTM5LjQ4NyA5Mi43MTA5IDUzNC44NDcgOTUuMDkyMkM1MjUgMTAwLjE0NSA1MTQuNTg2IDk4LjE1MjUgNTA0Ljc3NiA4OS4yNjQ2QzQ4OC44NjggNzQuODUxOCA0NzEuOTA1IDYyLjAzOTkgNDUxLjc4MSA1My45MTIzQzQzOC4xMTUgNDguMzkzIDQyMy45OTUgNDQuOTM3NCA0MDkuMjU3IDQ0LjYxMTFDMzkzLjE5NCA0NC4yNTU2IDM3Ny4xODQgNDQuMjY4NSAzNjEuMzk4IDQ4LjQ3OThDMzM4LjAwNyA1NC43MjAyIDMxOC4yMDEgNjcuMDY3NiAyOTkuOTYgODIuNTM1NUMyODMuMTY2IDk2Ljc3NjEgMjY2LjcyOSAxMTEuNDk0IDI0OC4xNTMgMTIzLjQ5MUMyMjYuMjEyIDEzNy42NjIgMjAyLjM0OCAxNDYuMzgxIDE3Ni40MDMgMTQ5LjkxQzE2NS44NTYgMTUxLjM0NCAxNTUuMzM2IDE1Mi4wMzEgMTQ0Ljc5MiAxNTEuNzczQzExNi44ODEgMTUxLjA5IDg5LjgxNiAxNDYuMjAyIDY0LjY2OCAxMzMuNDE4QzQ5LjM1OTUgMTI1LjYzNiAzNS40NTAxIDExNS43MjkgMjIuMTgwNCAxMDQuODMzQzE0Ljk2MDUgOTguOTA1MyA3Ljc0NjI2IDkzLjA0MzEgMS4zOTIyNyA4NS43MjM3QzEuMDYyNSA3OS41NDYzIDEuMDYyNSA3My41MDI3IDEuMDYyNSA2Ni45NjJDNC44MjgyIDYxLjMzNzMgOC43NDczNCA1Ni41MzI1IDE1LjI2MyA1NC41MTkxQzIzLjYzMjUgNTEuOTMyOCAzMC45NjIzIDUzLjc5NDQgMzcuNDc2OCA1OS4xNzUyQzUxLjYxODkgNzAuODU2MiA2NS42MDk2IDgyLjczMTUgODEuODI3NyA5MS41NTM4Qzk0LjQ4MjYgOTguNDM3OSAxMDguMDM1IDEwMi44OTIgMTIyLjE3OSAxMDUuMjI3QzEzMS4xODggMTA2LjcxNCAxNDAuMzU2IDEwNy42NjYgMTQ5LjUxOSAxMDcuNDc3QzE4My4xMjcgMTA2Ljc4NCAyMTIuOTI4IDk1Ljc0NDQgMjM5LjA5NCA3NC41NTQ2QzI1OC4xMzIgNTkuMTM4IDI3NS44NjEgNDIuMDgwMyAyOTYuNTcgMjguNzQ3OUMzMjAuMjUyIDEzLjUwMDUgMzQ1Ljc3NyAzLjYwNjY4IDM3NC4wNDUgMS4yMDY0QzM5Ny43MDcgLTAuODAyNzc3IDQyMS4yNjcgLTAuNjg5NjA2IDQ0NC41MjggNC41NTI3OEM0NjAuMjc2IDguMTAxOCA0NzUuMTEgMTQuMTgyMSA0ODkuMjA0IDIyLjExNjhDNTA2LjE5NCAzMS42ODIgNTIxLjI2NyA0My44Mzg0IDUzNi4xNDIgNTYuMjg1OEM1MzkuNzA2IDU5LjI2OCA1NDIuNjI3IDYyLjc2MTkgNTQ0Ljc5NyA2Ny4yODU0QzU0NS4wNjIgNzIuODYzMyA1NDUuMDYyIDc4LjE5OTIgNTQ1LjA2MiA4NC4wMzEzWiIgZmlsbD0iI0JGRDVGNyIvPgo8cGF0aCBkPSJNMS4wNjI1IDE4Mi43NzRDMy45NjM3MiAxODAuMTc2IDQuOTQ4NTEgMTc2LjQ4NCA3Ljk3NzE0IDE3NC4zN0MxNy40OTkzIDE2Ny43MjIgMzAuMTIwNiAxNjguNTgxIDM5LjYxMDEgMTc2Ljg2NkM1My4wNTAzIDE4OC42IDY2LjgzOTkgMTk5Ljg4OCA4Mi43MTg5IDIwOC4yMTdDOTcuNTEyOSAyMTUuOTc2IDExMy4yMzkgMjIwLjU5OSAxMjkuOTUgMjIyLjQwOEMxNTIuMzk1IDIyNC44MzggMTc0LjI5IDIyMi45OTYgMTk1LjYzMiAyMTUuNzEzQzIwOS4yNjEgMjExLjA2MiAyMjEuNTggMjAzLjgwNSAyMzMuMTExIDE5NS4yNDdDMjQ5Ljk2NSAxODIuNzM5IDI2NS4wMjcgMTY4LjAyNiAyODEuNzA3IDE1NS4zMjNDMzA3LjM3IDEzNS43NzkgMzM1LjYxOSAxMjIuMTIzIDM2OC4wNzQgMTE3Ljk2MUMzODIuMzIyIDExNi4xMzQgMzk2LjU5IDExNS4zNTIgNDEwLjgzNCAxMTYuMTU3QzQ0NS41MTUgMTE4LjEyIDQ3Ny4zOTcgMTI4LjMwNCA1MDUuOTE2IDE0OC44NkM1MTcuNTQgMTU3LjIzOCA1MjguMzc2IDE2Ni40NyA1MzkuMzcgMTc1LjU1N0M1NDEuNTkyIDE3Ny4zOTMgNTQyLjg5MiAxODAuMzQ2IDU0NC44NCAxODMuMDYyQzU0NS4wNjIgMTg4LjY3NiA1NDUuMDYyIDE5NC4wMTIgNTQ1LjA2MiAxOTkuODQ0QzUzOS43MDYgMjExLjYyIDUzMC4yMzggMjE0LjYxMyA1MTguNjc3IDIxMy41MTNDNTE0LjM3IDIxMy4xMDIgNTEwLjk3OCAyMTAuNzIxIDUwNy45ODYgMjA4LjA5MkM0OTcuOTA3IDE5OS4yMzggNDg3LjY2MSAxOTAuNTk4IDQ3Ni40NjMgMTgzLjIwMUM0NTguMSAxNzEuMDcxIDQzOC4xMjcgMTYzLjQ0MiA0MTYuMDI3IDE2MS4yNzFDNDA3Ljg4OCAxNjAuNDcxIDM5OS43OSAxNjAuMTczIDM5MS42OTcgMTYwLjQ2M0MzNjguOTkxIDE2MS4yNzcgMzQ3LjcwOSAxNjcuMDMxIDMyNy45NCAxNzguNjY5QzMxMS41NDEgMTg4LjMyMiAyOTcuNTQ5IDIwMC45MTUgMjgzLjE1MyAyMTMuMDc2QzI2MC42ODQgMjMyLjA1NyAyMzcuMjk0IDI0OS41NDUgMjA4LjgwNCAyNTguNzMxQzE5NS41MzMgMjYzLjAxIDE4MS45OCAyNjUuNTEzIDE2OC4wNjMgMjY2LjgzMUMxNTcuNzk1IDI2Ny44MDMgMTQ3LjU1OSAyNjcuOTY3IDEzNy4zNTYgMjY3LjU2M0MxMTQuODY3IDI2Ni42NzUgOTMuMTE3IDI2Mi4yMjYgNzIuMzU2NSAyNTMuMDQ1QzUyLjEyNzEgMjQ0LjA5OSAzNC40NzU5IDIzMS40NyAxNy43MTY5IDIxNy4yNzVDMTEuNzg4OSAyMTIuMjUzIDUuNDYzMiAyMDcuNzc4IDEuMzE5NjEgMjAwLjU3OUMxLjA2MjUgMTk0LjY1IDEuMDYyNSAxODguOTYxIDEuMDYyNSAxODIuNzc0WiIgZmlsbD0iIzNCODJGNiIvPgo8cGF0aCBkPSJNMi4wMDE5OGUtMDggMjk3Ljk2NkMwLjU1ODUyIDI5Ni45OTYgMS4yNzM0OSAyOTYuNjU5IDEuNjUyNzIgMjk2LjA4MUMxMS40OTUyIDI4MS4wODEgMjguMDI5OCAyODEuNTk3IDQwLjk1MzggMjk0LjEyQzU3LjM0NTYgMzEwLjAwNCA3NS4yNzU0IDMyMy44MzEgOTYuNDQ5IDMzMi4wNDJDMTA5LjUyOSAzMzcuMTE1IDEyMy4xMjMgMzQwLjE5NiAxMzcuMjI3IDM0MC40MzdDMTU1LjYzNCAzNDAuNzUxIDE3My44NDYgMzQwLjIgMTkxLjU3MiAzMzMuODYzQzIwNC4wNjIgMzI5LjM5OCAyMTUuNzE3IDMyMy4zODUgMjI2LjUyIDMxNS41ODVDMjQ2LjE1NyAzMDEuNDA2IDI2My4xMSAyODMuNzE3IDI4Mi4wODkgMjY4LjY3MUMzMDguMzMxIDI0Ny44NjcgMzM3LjI3OSAyMzQuMDk4IDM3MC4zNjggMjMwLjE0QzQwMC41NTMgMjI2LjUyOSA0MzAuMTMxIDIyOC40MjcgNDU5LjEwOCAyMzguMTUyQzQ4MC43NiAyNDUuNDE5IDQ5OS42NjkgMjU3Ljg5NCA1MTcuMzY2IDI3Mi41NEM1MjMuMDM0IDI3Ny4yMyA1MjguNTg0IDI4Mi4wNzYgNTM0LjE2IDI4Ni44ODZDNTM3Ljg2OSAyOTAuMDg1IDU0MC45NzQgMjkzLjg2MiA1NDMuODg3IDI5OC4zMDFDNTQ0LjE0MSAzMDQuNTEzIDU0My44ODcgMzExLjY3MiA1NDMuODg3IDMxOC4xNDhDNTQwLjQzNyAzMjMuODcyIDUzNi45NyAzMjcuMjg5IDUzMC44NjggMzI5LjU5M0M1MjIuMDk1IDMzMi45MDUgNTE0LjQ3OCAzMzAuODk4IDUwNy42MjMgMzI1LjA4OUM0OTMuOTE4IDMxMy40NzUgNDgwLjY1NCAzMDEuMzE0IDQ2NS4xMzIgMjkyLjIxNkM0NTEuODg4IDI4NC40NTUgNDM3LjcxMyAyNzkuNjYyIDQyMi45MjYgMjc2Ljk0NEM0MTMuOTMgMjc1LjI5IDQwNC43NDYgMjc0LjI0IDM5NS41NjUgMjc0LjU3MkMzNjUuNDM0IDI3NS42NjIgMzM3Ljc4MSAyODQuMjQgMzEzLjI5MSAzMDMuNDNDMjk3LjMzNSAzMTUuOTMzIDI4Mi44MTggMzMwLjE5NyAyNjcuMTY3IDM0My4wMzVDMjQyLjI1OSAzNjMuNDY3IDIxNC45OTEgMzc5LjQyMyAxODMuMzU4IDM4NC4zMDlDMTQ1LjkxOSAzOTAuMDkxIDEwOC42NjIgMzg4Ljc2NCA3My4xNjA5IDM3My4wMUM1NS44Njk5IDM2NS4zMzYgNDAuMDgwMiAzNTQuNzIyIDI1LjU1OCAzNDIuMTU1QzIwLjI3MDEgMzM3LjU3OSAxNC45NDI2IDMzMy4wNTEgOS41NTAyNCAzMjguNjExQzUuODg0MzEgMzI1LjU5MyAzLjM1NTgyIDMyMS42MDkgMC4zMjAzNTcgMzE3LjYxNUMtMy4wOTk0NGUtMDYgMzExLjEzOCAtMy4xNjgzMWUtMDYgMzA0LjgxMiAyLjAwMTk4ZS0wOCAyOTcuOTY2WiIgZmlsbD0iI0JGRDVGNyIvPgo8cGF0aCBkPSJNNjU3Ljk1MiAyOTdWOTAuNDU0NUg3OTQuNzA3VjEyNi40NTlINzAxLjYyMVYxNzUuNjc1SDc4NS42MzFWMjExLjY3OUg3MDEuNjIxVjI5N0g2NTcuOTUyWiIgZmlsbD0iIzFEMjYzMCIvPgo8cGF0aCBkPSJNODY2LjIzNyA5MC40NTQ1VjI5N0g4MjMuMjc0VjkwLjQ1NDVIODY2LjIzN1oiIGZpbGw9IiMxRDI2MzAiLz4KPHBhdGggZD0iTTk3MC42NDQgMzAwLjAyNkM5NTQuOTc4IDMwMC4wMjYgOTQxLjQzMSAyOTYuNjk3IDkzMC4wMDEgMjkwLjA0MUM5MTguNjM4IDI4My4zMTggOTA5Ljg2NCAyNzMuOTcyIDkwMy42NzggMjYyLjAwNEM4OTcuNDkzIDI0OS45NjkgODk0LjQgMjM2LjAxOCA4OTQuNCAyMjAuMTUxQzg5NC40IDIwNC4xNDkgODk3LjQ5MyAxOTAuMTY0IDkwMy42NzggMTc4LjE5NkM5MDkuODY0IDE2Ni4xNjEgOTE4LjYzOCAxNTYuODE1IDkzMC4wMDEgMTUwLjE1OUM5NDEuNDMxIDE0My40MzYgOTU0Ljk3OCAxNDAuMDc0IDk3MC42NDQgMTQwLjA3NEM5ODYuMzEgMTQwLjA3NCA5OTkuODI0IDE0My40MzYgMTAxMS4xOSAxNTAuMTU5QzEwMjIuNjIgMTU2LjgxNSAxMDMxLjQyIDE2Ni4xNjEgMTAzNy42MSAxNzguMTk2QzEwNDMuOCAxOTAuMTY0IDEwNDYuODkgMjA0LjE0OSAxMDQ2Ljg5IDIyMC4xNTFDMTA0Ni44OSAyMzYuMDE4IDEwNDMuOCAyNDkuOTY5IDEwMzcuNjEgMjYyLjAwNEMxMDMxLjQyIDI3My45NzIgMTAyMi42MiAyODMuMzE4IDEwMTEuMTkgMjkwLjA0MUM5OTkuODI0IDI5Ni42OTcgOTg2LjMxIDMwMC4wMjYgOTcwLjY0NCAzMDAuMDI2Wk05NzAuODQ2IDI2Ni43NDRDOTc3Ljk3MyAyNjYuNzQ0IDk4My45MjMgMjY0LjcyNyA5ODguNjk3IDI2MC42OTNDOTkzLjQ3IDI1Ni41OTIgOTk3LjA2NyAyNTEuMDExIDk5OS40ODggMjQzLjk1MkMxMDAxLjk4IDIzNi44OTIgMTAwMy4yMiAyMjguODU3IDEwMDMuMjIgMjE5Ljg0OEMxMDAzLjIyIDIxMC44MzkgMTAwMS45OCAyMDIuODA0IDk5OS40ODggMTk1Ljc0NEM5OTcuMDY3IDE4OC42ODUgOTkzLjQ3IDE4My4xMDQgOTg4LjY5NyAxNzkuMDAzQzk4My45MjMgMTc0LjkwMiA5NzcuOTczIDE3Mi44NTEgOTcwLjg0NiAxNzIuODUxQzk2My42NTIgMTcyLjg1MSA5NTcuNjAxIDE3NC45MDIgOTUyLjY5MyAxNzkuMDAzQzk0Ny44NTIgMTgzLjEwNCA5NDQuMTg3IDE4OC42ODUgOTQxLjcgMTk1Ljc0NEM5MzkuMjc5IDIwMi44MDQgOTM4LjA2OSAyMTAuODM5IDkzOC4wNjkgMjE5Ljg0OEM5MzguMDY5IDIyOC44NTcgOTM5LjI3OSAyMzYuODkyIDk0MS43IDI0My45NTJDOTQ0LjE4NyAyNTEuMDExIDk0Ny44NTIgMjU2LjU5MiA5NTIuNjkzIDI2MC42OTNDOTU3LjYwMSAyNjQuNzI3IDk2My42NTIgMjY2Ljc0NCA5NzAuODQ2IDI2Ni43NDRaIiBmaWxsPSIjMUQyNjMwIi8+CjxwYXRoIGQ9Ik0xMTAxLjUgMjk3TDEwNTkuMzQgMTQyLjA5MUgxMTAyLjgxTDExMjYuODEgMjQ2LjE3SDExMjguMjNMMTE1My4yNCAxNDIuMDkxSDExOTUuOUwxMjIxLjMxIDI0NS41NjVIMTIyMi42MkwxMjQ2LjIyIDE0Mi4wOTFIMTI4OS41OUwxMjQ3LjUzIDI5N0gxMjAyLjA1TDExNzUuNDIgMTk5LjU3N0gxMTczLjUxTDExNDYuODggMjk3SDExMDEuNVoiIGZpbGw9IiMxRDI2MzAiLz4KPHBhdGggZD0iTTEzNTUuNDcgOTAuNDU0NVYyOTdIMTMxMi41MVY5MC40NTQ1SDEzNTUuNDdaIiBmaWxsPSIjMUQyNjMwIi8+CjxwYXRoIGQ9Ik0xNDE2LjQxIDM1NS4wOTFDMTQxMC45NyAzNTUuMDkxIDE0MDUuODYgMzU0LjY1NCAxNDAxLjA4IDM1My43OEMxMzk2LjM4IDM1Mi45NzMgMTM5Mi40OCAzNTEuOTMxIDEzODkuMzggMzUwLjY1M0wxMzk5LjA2IDMxOC41ODJDMTQwNC4xMSAzMjAuMTI5IDE0MDguNjUgMzIwLjk2OSAxNDEyLjY4IDMyMS4xMDRDMTQxNi43OCAzMjEuMjM4IDE0MjAuMzEgMzIwLjI5NyAxNDIzLjI3IDMxOC4yOEMxNDI2LjI5IDMxNi4yNjMgMTQyOC43NSAzMTIuODM0IDE0MzAuNjMgMzA3Ljk5M0wxNDMzLjE1IDMwMS40MzhMMTM3Ny41OCAxNDIuMDkxSDE0MjIuNzZMMTQ1NC44NCAyNTUuODUySDE0NTYuNDVMMTQ4OC44MiAxNDIuMDkxSDE1MzQuMzFMMTQ3NC4xIDMxMy43NDFDMTQ3MS4yMSAzMjIuMDc5IDE0NjcuMjcgMzI5LjM0IDE0NjIuMyAzMzUuNTI2QzE0NTcuMzkgMzQxLjc3OCAxNDUxLjE3IDM0Ni41ODYgMTQ0My42NCAzNDkuOTQ3QzE0MzYuMTEgMzUzLjM3NiAxNDI3LjAzIDM1NS4wOTEgMTQxNi40MSAzNTUuMDkxWiIgZmlsbD0iIzFEMjYzMCIvPgo8L3N2Zz4K',
    },
    questions: {
      mainColor: '#FF9800',
      backgroundColor: '#FFF3E0',
      badge: {
        iconName: 'question',
        color: '#FF9800',
      },
      keyword: 'defaultQuestionKeyword',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#2196F3',
      backgroundColor: '#E3F2FD',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#F44336',
      backgroundColor: '#F443361A',
      badge: {
        iconName: 'shield',
        color: '#F44336',
      },
      isEnabled: true,
    },
    gif: {
      isEnabled: true,
    },
    usernames: {
      isEnabled: true,
    },
  };

  private static currentStyles: StylesResponse = { ...apiService.getDefaultStyles() };

  private static async encryptData(data: string): Promise<string> {
    const salt = crypto
      .getRandomValues(new Uint8Array(16))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
    return btoa(`${salt}:${data}`);
  }

  private static async decryptData(encryptedData: string): Promise<string> {
    try {
      const decoded = atob(encryptedData);
      const [, data] = decoded.split(':');
      return data || '';
    } catch {
      this.clearStoredData();
      return '';
    }
  }

  private static async verifyIntegrity(
    institution: ApiResponse['institution'],
    apiKey: string,
  ): Promise<boolean> {
    const data = `${institution.domain}:${institution.name}:${apiKey}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashHex === institution.checksum;
  }

  /**
   * Extract workspace code from the manifest URL query parameters
   * When loading the plugin, BBB allows passing query params in the manifest URL:
   * pluginManifests=[{"url": "https://domain/manifest.json?workspace=CODE"}]
   */
  private static extractWorkspaceFromManifest(): string | null {
    try {
      // The workspace parameter is passed via the plugin_ parameter in /create call
      // BBB substitutes ${plugin_FlowlyPlugin_workspace:} in the javascriptEntrypointUrl
      // We extract it from the script tag that loaded the plugin
      const scripts = document.querySelectorAll('script[src*="FlowlyWebIntegration.js"]');

      // Convert NodeList to Array for iteration
      const scriptArray = Array.from(scripts);
      for (let i = 0; i < scriptArray.length; i++) {
        const script = scriptArray[i];
        const src = script.getAttribute('src');
        if (src) {
          try {
            const url = new URL(src, window.location.origin);
            const workspace = url.searchParams.get('workspace');
            if (workspace && workspace.trim() !== '') {
              return workspace;
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }

      // Fallback: check if workspace is in current page URL
      const urlParams = new URLSearchParams(window.location.search);
      const workspace = urlParams.get('workspace');
      if (workspace && workspace.trim() !== '') {
        return workspace;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch institution/workspace styles using manual fetch
   * Uses the origin header to identify the institution
   * Optionally uses workspace parameter from plugin_ parameter via BBB substitution
   */
  static async fetchInstitutionStyles(): Promise<StylesResponse> {
    try {
      // Extract workspace code from script URL (injected via plugin_FlowlyPlugin_workspace)
      const workspaceCode = this.extractWorkspaceFromManifest();

      // Build URL with optional workspace parameter
      let url = `${this.BASE_URL}/institutions/styles`;
      if (workspaceCode) {
        url += `?workspaceCode=${encodeURIComponent(workspaceCode)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return this.defaultStyles;
      }

      return await response.json();
    } catch {
      return this.defaultStyles;
    }
  }

  static async sendHeartbeat(data: {
    serverId: string;
    meetingId: string;
    userId: string;
    timestamp: number;
  }): Promise<boolean> {
    if (!this.isInitialized()) {
      // eslint-disable-next-line no-console
      console.error('API Service not initialized');
      return false;
    }

    try {
      // Note: The browser automatically sends the 'Origin' header for cross-origin requests
      // We don't need to set it manually - the API will read it from the request
      const headers = {
        'Content-Type': 'application/json',
      };

      const response = await fetch(`${this.BASE_URL}/servers/heartbeat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error sending heartbeat:', error);
      return false;
    }
  }

  static getStyles(): StylesResponse {
    return this.currentStyles;
  }

  private static async storeInstitutionData(
    apiKey: string,
    institution: ApiResponse['institution'],
  ): Promise<void> {
    const encryptedApiKey = await this.encryptData(apiKey);

    const storageData = {
      apiKey: encryptedApiKey,
      institution: JSON.stringify(institution),
      styles: this.currentStyles,
      timestamp: Date.now(),
    };

    localStorage.setItem(`${this.STORAGE_PREFIX}data`, JSON.stringify(storageData));
  }

  private static getStoredData(): {
    apiKey: string;
    institution: string;
    styles?: StylesResponse;
    timestamp: number;
  } | null {
    const data = localStorage.getItem(`${this.STORAGE_PREFIX}data`);
    if (data) {
      const parsedData = JSON.parse(data);

      if (parsedData.styles) {
        this.currentStyles = parsedData.styles;
      }
      return parsedData;
    }
    return null;
  }

  static async getApiKey(): Promise<string | null> {
    const storedData = this.getStoredData();
    if (!storedData) return null;

    try {
      return await this.decryptData(storedData.apiKey);
    } catch {
      return null;
    }
  }

  static extractDomain(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.split('.');
      return parts.length > 2 ? parts.slice(-2).join('.') : hostname;
    } catch {
      return '';
    }
  }

  static clearStoredData(): void {
    localStorage.removeItem(`${this.STORAGE_PREFIX}data`);
    this.encryptionKey = null;
    this.currentStyles = { ...this.defaultStyles };
  }
}
