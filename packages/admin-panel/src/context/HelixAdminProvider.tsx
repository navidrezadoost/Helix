import {
  createContext,
  type FC,
  type PropsWithChildren,
  useContext,
  useMemo,
} from 'react';

export type AdminTranslations = Record<string, string>;

export interface HelixAdminConfig {
  title?: string;
  logo?: string;
  primaryColor?: string;
  theme?: 'light' | 'dark';
}

export interface HelixAdminProviderProps extends PropsWithChildren {
  locale?: string;
  translations?: AdminTranslations;
  config?: HelixAdminConfig;
}

const defaultTranslations: AdminTranslations = {
  forms: 'Forms',
  createNewForm: 'Create New Form',
  loadingSchema: 'Loading schema...',
  schemaNotFound: 'Schema not found',
  fieldsAndRules: 'Fields & Rules',
  dataSources: 'Data Sources',
  globalRules: 'Global Rules',
  saveDraft: 'Save Draft',
  saving: 'Saving...',
  publish: 'Publish',
  publishing: 'Publishing...',
  delete: 'Delete',
  createNewVersion: 'Create New Version',
  back: 'Back',
  untitledForm: 'Untitled Form',
  searchForms: 'Search forms...',
  allStatuses: 'All statuses',
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

interface HelixAdminContextValue {
  locale: string;
  translations: AdminTranslations;
  config: HelixAdminConfig;
  t: (key: string, fallback?: string) => string;
}

const HelixAdminContext = createContext<HelixAdminContextValue>({
  locale: 'en',
  translations: defaultTranslations,
  config: {},
  t: (key: string, fallback?: string) => defaultTranslations[key] ?? fallback ?? key,
});

export const HelixAdminProvider: FC<HelixAdminProviderProps> = ({
  children,
  locale = 'en',
  translations = {},
  config = {},
}) => {
  const value = useMemo<HelixAdminContextValue>(() => {
    const mergedTranslations = {
      ...defaultTranslations,
      ...translations,
    };

    return {
      locale,
      translations: mergedTranslations,
      config,
      t: (key: string, fallback?: string) => mergedTranslations[key] ?? fallback ?? key,
    };
  }, [config, locale, translations]);

  return (
    <HelixAdminContext.Provider value={value}>
      <div
        data-helix-admin-locale={locale}
        data-helix-admin-theme={config.theme ?? 'light'}
        style={config.primaryColor ? ({ ['--helix-primary' as string]: config.primaryColor }) : undefined}
      >
        {children}
      </div>
    </HelixAdminContext.Provider>
  );
};

export function useHelixAdmin(): HelixAdminContextValue {
  return useContext(HelixAdminContext);
}

export { defaultTranslations };
