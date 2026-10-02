import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppConfig, ConfigSection } from '../types';
import { api } from '../services/api';

interface ConfigContextType {
  config: AppConfig;
  reload: () => Promise<void>;
  updateSection: <K extends ConfigSection>(section: K, value: AppConfig[K]) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

/**
 * Loads the runtime configuration (loan products, master lists, numbering, company profile)
 * from the server once, and holds the app until it is available so every screen can rely on it.
 */
export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setConfig(await api.getConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const updateSection = useCallback(async <K extends ConfigSection>(section: K, value: AppConfig[K]) => {
    setConfig(await api.updateConfigSection(section, value));
  }, []);

  if (!config) {
    return (
      <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center gap-3 text-slate-300 p-4 text-center">
        {error ? (
          <>
            <p className="text-sm font-semibold text-rose-300">Could not load configuration: {error}</p>
            <button
              type="button"
              onClick={reload}
              className="px-4 py-2 rounded-xl bg-gold-500 text-navy-950 font-bold text-xs cursor-pointer"
            >
              Retry
            </button>
          </>
        ) : (
          <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={{ config, reload, updateSection }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
