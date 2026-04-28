import { create } from 'zustand'
import { settingsApi } from '../api/settings'
import { modelsApi } from '../api/models'
import type { FeatureFlags } from '../types/features'
import type { PermissionCapabilities, PermissionMode, EffortLevel, ModelInfo, ThemeMode } from '../types/settings'
import type { Locale } from '../i18n'
import { useUIStore } from './uiStore'

const LOCALE_STORAGE_KEY = 'cc-haha-locale'

function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'en' || stored === 'zh') return stored
  } catch { /* localStorage unavailable */ }
  return 'zh'
}

type SettingsStore = {
  permissionMode: PermissionMode
  permissionCapabilities: PermissionCapabilities
  currentModel: ModelInfo | null
  effortLevel: EffortLevel
  availableModels: ModelInfo[]
  activeProviderName: string | null
  locale: Locale
  theme: ThemeMode
  skipWebFetchPreflight: boolean
  features: FeatureFlags
  isLoading: boolean
  error: string | null

  fetchAll: () => Promise<void>
  setPermissionMode: (mode: PermissionMode) => Promise<void>
  setModel: (modelId: string) => Promise<void>
  setEffort: (level: EffortLevel) => Promise<void>
  setLocale: (locale: Locale) => void
  setTheme: (theme: ThemeMode) => Promise<void>
  setSkipWebFetchPreflight: (enabled: boolean) => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  permissionMode: 'default',
  permissionCapabilities: {
    availableModes: ['default', 'acceptEdits', 'plan', 'dontAsk'],
    canUseBypassPermissions: false,
  },
  currentModel: null,
  effortLevel: 'medium',
  availableModels: [],
  activeProviderName: null,
  locale: getStoredLocale(),
  theme: useUIStore.getState().theme,
  skipWebFetchPreflight: true,
  features: { computerUse: true },
  isLoading: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      const [permissionRes, modelsRes, { model }, { level }, userSettings, features] = await Promise.all([
        settingsApi.getPermissionMode(),
        modelsApi.list(),
        modelsApi.getCurrent(),
        modelsApi.getEffort(),
        settingsApi.getUser(),
        settingsApi.getFeatures(),
      ])
      const theme = userSettings.theme === 'dark' ? 'dark' : 'light'
      useUIStore.getState().setTheme(theme)
      set({
        permissionMode: permissionRes.mode,
        permissionCapabilities: {
          availableModes: permissionRes.availableModes,
          canUseBypassPermissions: permissionRes.canUseBypassPermissions,
          bypassPermissionsUnavailableReason: permissionRes.bypassPermissionsUnavailableReason,
        },
        availableModels: modelsRes.models,
        activeProviderName: modelsRes.provider?.name ?? null,
        currentModel: model,
        effortLevel: level,
        theme,
        skipWebFetchPreflight: userSettings.skipWebFetchPreflight !== false,
        features,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load desktop settings'
      set({ isLoading: false, error: message })
      throw error
    }
  },

  setPermissionMode: async (mode) => {
    const { permissionCapabilities } = get()
    if (
      mode === 'bypassPermissions' &&
      !permissionCapabilities.canUseBypassPermissions
    ) {
      throw new Error(
        permissionCapabilities.bypassPermissionsUnavailableReason ||
          'Bypass permissions mode is not available in this server environment',
      )
    }

    const prev = get().permissionMode
    set({ permissionMode: mode })
    try {
      const res = await settingsApi.setPermissionMode(mode)
      set({
        permissionMode: res.mode,
        permissionCapabilities: {
          availableModes: res.availableModes,
          canUseBypassPermissions: res.canUseBypassPermissions,
          bypassPermissionsUnavailableReason: res.bypassPermissionsUnavailableReason,
        },
      })
    } catch (error) {
      set({ permissionMode: prev })
      throw error
    }
  },

  setModel: async (modelId) => {
    await modelsApi.setCurrent(modelId)
    const { model } = await modelsApi.getCurrent()
    set({ currentModel: model })
  },

  setEffort: async (level) => {
    const prev = get().effortLevel
    set({ effortLevel: level })
    try {
      await modelsApi.setEffort(level)
    } catch {
      set({ effortLevel: prev })
    }
  },

  setLocale: (locale) => {
    set({ locale })
    try { localStorage.setItem(LOCALE_STORAGE_KEY, locale) } catch { /* noop */ }
  },

  setTheme: async (theme) => {
    const prev = get().theme
    set({ theme })
    useUIStore.getState().setTheme(theme)
    try {
      await settingsApi.updateUser({ theme })
    } catch {
      set({ theme: prev })
      useUIStore.getState().setTheme(prev)
    }
  },

  setSkipWebFetchPreflight: async (enabled) => {
    const prev = get().skipWebFetchPreflight
    set({ skipWebFetchPreflight: enabled })
    try {
      await settingsApi.updateUser({ skipWebFetchPreflight: enabled })
    } catch {
      set({ skipWebFetchPreflight: prev })
    }
  },
}))
