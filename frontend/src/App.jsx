import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SipTracker from './pages/SipTracker';
import LumpsumTracker from './pages/LumpsumTracker';
import Watchlist from './pages/Watchlist';
import useSystemHealth from './hooks/useSystemHealth';

function App() {
  useSystemHealth();

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sip" element={<SipTracker />} />
          <Route path="/lumpsum" element={<LumpsumTracker />} />
          <Route path="/watchlist" element={<Watchlist />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
