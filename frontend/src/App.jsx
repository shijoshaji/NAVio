import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Holdings from './pages/Holdings';
import SipTracker from './pages/SipTracker';

import LumpsumTracker from './pages/LumpsumTracker';
import Watchlist from './pages/Watchlist';
import Settings from './pages/Settings';
import { PrivacyProvider } from './context/PrivacyContext';
import useSystemHealth from './hooks/useSystemHealth';

function App() {
  useSystemHealth();

  return (
    <PrivacyProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/sip" element={<SipTracker />} />
            <Route path="/lumpsum" element={<LumpsumTracker />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </PrivacyProvider>
  );
}

export default App;
