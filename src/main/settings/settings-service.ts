import fs from 'fs'
import path from 'path'
import { AppSettingsSchema, type AppSettings } from '../../shared/schemas'
import { DEFAULT_KEYBINDINGS } from '../../shared/constants'
import { atomicWriteFile } from '../workspace/multi-root-registry'

export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

export class SettingsAndCredentialService {
  private settingsPath: string
  private credentialsPath: string
  private keybindingsPath: string
  private settings: AppSettings
  private encryptedCredentials: Record<string, string> = {}

  constructor(
    userDataDir: string,
    private safeStorageAdapter?: SafeStorageAdapter
  ) {
    fs.mkdirSync(userDataDir, { recursive: true })
    this.settingsPath = path.join(userDataDir, 'settings.json')
    this.credentialsPath = path.join(userDataDir, 'credentials.enc.json')
    this.keybindingsPath = path.join(userDataDir, 'keybindings.json')
    this.settings = this.loadSettings()
    this.loadCredentials()
  }

  private loadSettings(): AppSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = JSON.parse(fs.readFileSync(this.settingsPath, 'utf-8'))
        let parsed = AppSettingsSchema.safeParse(raw)
        if (!parsed.success && raw && typeof raw === 'object' && !Array.isArray(raw)) {
          // One bad field (an older or newer version's value, a hand edit) must not throw away every
          // other setting, custom templates included. Keep a copy of the file, drop only the fields
          // that fail validation, and let those fall back to their defaults.
          try {
            fs.copyFileSync(this.settingsPath, `${this.settingsPath}.bak`)
          } catch {
            // Backup is best effort
          }
          const repaired: Record<string, unknown> = { ...(raw as Record<string, unknown>) }
          for (const issue of parsed.error.issues) {
            const topKey = issue.path[0]
            if (typeof topKey === 'string') delete repaired[topKey]
          }
          parsed = AppSettingsSchema.safeParse(repaired)
        }
        if (parsed.success) {
          return {
            ...parsed.data,
            keybindings: {
              ...DEFAULT_KEYBINDINGS,
              ...parsed.data.keybindings
            }
          }
        }
      }
    } catch {
      // Fallback to default
    }
    const defaults = AppSettingsSchema.parse({})
    defaults.keybindings = { ...DEFAULT_KEYBINDINGS }
    return defaults
  }

  private loadCredentials(): void {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        this.encryptedCredentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf-8'))
      }
    } catch {
      this.encryptedCredentials = {}
    }
  }

  getSettings(): AppSettings {
    return this.settings
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const merged = {
      ...this.settings,
      ...partial,
      typography: {
        ...this.settings.typography,
        ...(partial.typography || {})
      },
      ai: {
        ...this.settings.ai,
        ...(partial.ai || {})
      },
      keybindings: {
        ...this.settings.keybindings,
        ...(partial.keybindings || {})
      }
    }
    const validated = AppSettingsSchema.parse(merged)
    this.settings = validated
    await atomicWriteFile(this.settingsPath, JSON.stringify(validated, null, 2))
    await atomicWriteFile(this.keybindingsPath, JSON.stringify(validated.keybindings, null, 2))
    return validated
  }

  /**
   * Stores credentials exclusively using Electron's OS keychain `safeStorage` encryption.
   * Never writes plaintext tokens into settings.json, workspace.json, or logs.
   */
  async setSecret(serviceKey: string, secretValue: string): Promise<void> {
    if (!serviceKey.trim()) throw new Error('Invalid credential key')
    if (!this.safeStorageAdapter || !this.safeStorageAdapter.isEncryptionAvailable()) {
      // Never fall back to storing the secret readably on disk (base64 is not encryption).
      throw new Error(
        'Cannot store the credential: OS encryption (Keychain / Credential Manager / Secret Service) is not available'
      )
    }
    const encryptedBuf = this.safeStorageAdapter.encryptString(secretValue)
    this.encryptedCredentials[serviceKey] = `enc:${encryptedBuf.toString('base64')}`
    await atomicWriteFile(this.credentialsPath, JSON.stringify(this.encryptedCredentials, null, 2))
  }

  hasSecret(serviceKey: string): boolean {
    return Boolean(this.encryptedCredentials[serviceKey])
  }

  getSecret(serviceKey: string): string | null {
    const stored = this.encryptedCredentials[serviceKey]
    if (!stored) return null
    if (stored.startsWith('enc:') && this.safeStorageAdapter?.isEncryptionAvailable()) {
      const buf = Buffer.from(stored.slice(4), 'base64')
      return this.safeStorageAdapter.decryptString(buf)
    }
    if (stored.startsWith('b64:')) {
      return Buffer.from(stored.slice(4), 'base64').toString('utf-8')
    }
    return null
  }

  async deleteSecret(serviceKey: string): Promise<void> {
    delete this.encryptedCredentials[serviceKey]
    await atomicWriteFile(this.credentialsPath, JSON.stringify(this.encryptedCredentials, null, 2))
  }
}
