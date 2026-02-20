import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { NotistackProvider } from '../providers/NotistackProvider';
import { Auth0ProviderWithHistory } from '../providers/Auth0Provider';
import { AppRouter } from '../routes/AppRouter';
import { theme } from '../theme';

const App = () => {
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <NotistackProvider>
          <Routes>
            <Route
              path="/*"
              element={
                <Auth0ProviderWithHistory>
                  <AppRouter />
                </Auth0ProviderWithHistory>
              }
            />
          </Routes>
        </NotistackProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
