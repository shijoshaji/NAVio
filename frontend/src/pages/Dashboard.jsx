import { useState, useEffect } from 'react';
import { getPortfolio, syncNav, getSyncStatus } from '../services/api';
import { RefreshCw, TrendingUp, IndianRupee, PieChart, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

const Dashboard = () => {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null);

    const fetchSyncStatus = async () => {
        try {
            const { data } = await getSyncStatus();
            setSyncStatus(data);
        } catch (error) {
            console.error("Failed to fetch sync status", error);
        }
    };

    const fetchPortfolio = async () => {
        try {
            const { data } = await getPortfolio();
            setPortfolio(data);
        } catch (error) {
            console.error("Failed to fetch portfolio", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSyncStatus();
        fetchPortfolio();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        const toastId = toast.loading('Syncing NAV...');
        try {
            await syncNav();
            await fetchSyncStatus();
            await fetchPortfolio();
            toast.success('NAV Sync Completed!', { id: toastId });
        } catch (error) {
            console.error("Sync failed", error);
            toast.error('Sync failed', { id: toastId });
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-slate-400">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    {syncStatus?.last_sync && (
                        <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last synced: {new Date(syncStatus.last_sync).toLocaleString()} ({syncStatus.total_schemes?.toLocaleString()} schemes)
                        </p>
                    )}
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-slate-800 text-slate-50 hover:bg-slate-700 h-10 px-4 py-2 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync NAV'}
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Total Invested</h3>
                        <IndianRupee className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-bold">₹{portfolio?.total_invested?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0.00'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Current Value</h3>
                        <TrendingUp className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">₹{portfolio?.total_current_value?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0.00'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Total Gain/Loss</h3>
                        <PieChart className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className={`text-2xl font-bold ${portfolio?.total_gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolio?.total_gain >= 0 ? '+' : ''}₹{portfolio?.total_gain?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0.00'}
                    </div>
                </div>
            </div>

            {/* Holdings Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow">
                <div className="p-6 flex flex-row items-center justify-between">
                    <h3 className="text-lg font-semibold">Your Holdings</h3>
                </div>
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b border-slate-800 transition-colors hover:bg-slate-800/50">
                                <th className="h-12 px-4 text-left align-middle font-medium text-slate-400">Scheme</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-slate-400">Units</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-slate-400">Avg NAV</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-slate-400">Cur NAV</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-slate-400">Invested</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-slate-400">Current</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-slate-400">Gain %</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {portfolio?.holdings?.map((item) => (
                                <tr key={item.scheme_code} className="border-b border-slate-800 transition-colors hover:bg-slate-800/50">
                                    <td className="p-4 align-middle font-medium">
                                        {item.scheme_name}
                                        <div className="text-xs text-slate-400">{item.scheme_code}</div>
                                    </td>
                                    <td className="p-4 align-middle text-right">{item.total_units.toFixed(3)}</td>
                                    <td className="p-4 align-middle text-right">{item.average_nav.toFixed(2)}</td>
                                    <td className="p-4 align-middle text-right">{item.current_nav.toFixed(2)}</td>
                                    <td className="p-4 align-middle text-right">₹{item.invested_amount.toLocaleString()}</td>
                                    <td className="p-4 align-middle text-right">₹{item.current_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className={`p-4 align-middle text-right ${item.return_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {item.return_percentage.toFixed(2)}%
                                    </td>
                                </tr>
                            ))}
                            {(!portfolio?.holdings || portfolio.holdings.length === 0) && (
                                <tr>
                                    <td colSpan={7} className="p-4 text-center text-slate-400">No holdings found. Start investing!</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
