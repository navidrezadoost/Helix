import { type FC } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { FormBuilder } from './components/FormBuilder/FormBuilder';
import { SchemaList } from './components/FormBuilder/SchemaList';
import { ThemeProvider } from './components/theme-provider';
import { HelixAdminProvider } from './context/HelixAdminProvider';
import './App.css';

const BuilderRoute: FC = () => {
  const { schemaId } = useParams();

  return <FormBuilder initialSchemaId={schemaId} />;
};

const App: FC = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <HelixAdminProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/schemas" replace />} />
            <Route
              path="/schemas"
              element={(
                <SchemaList
                  onSelectSchema={(id: string) => {
                    window.location.href = `/builder/${id}`;
                  }}
                  onCreateNew={() => {
                    window.location.href = '/builder/new';
                  }}
                />
              )}
            />
            <Route path="/builder/new" element={<FormBuilder />} />
            <Route path="/builder/:schemaId" element={<BuilderRoute />} />
          </Routes>
        </BrowserRouter>
      </HelixAdminProvider>
    </ThemeProvider>
  );
};

export default App;
