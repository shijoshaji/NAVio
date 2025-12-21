import { useState, useEffect, useMemo } from 'react';
import { getPortfolio, syncNav, getSyncStatus } from '../services/api';
import { RefreshCw, TrendingUp, IndianRupee, PieChart as PieChartIcon, Clock, Percent, ChevronDown, Filter, Sparkles, Award, Zap, AlertCircle, ArrowDown, TrendingDown, Shield, Umbrella } from 'lucide-react';
import { generatePortfolioInsights } from '../utils/portfolioIQ';
import { toast } from 'react-hot-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Dashboard = () => {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null);

    // Filter State
    const [filterType, setFilterType] = useState('all'); // 'all', 'SIP', 'LUMPSUM'
    const [dropdownOpen, setDropdownOpen] = useState(false);

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
            const { data } = await getPortfolio(filterType);
            setPortfolio(data);
        } catch (error) {
            console.error("Failed to fetch portfolio", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSyncStatus();
    }, []);

    useEffect(() => {
        fetchPortfolio();
    }, [filterType]);

    const { amcData, assetData, sectorData } = useMemo(() => {
        if (!portfolio?.holdings) return { amcData: [], assetData: [], sectorData: [] };

        const amcAgg = {};
        const assetAgg = {};
        const sectorAgg = {};

        portfolio.holdings.forEach(item => {
            // 1. Calculate AMC
            // Priority 1: Use fund_house from API (Best)
            let amc = item.fund_house
                ? item.fund_house.replace(" Mutual Fund", "").trim()
                : null;

            // Priority 2: Smart Regex Fallback (if API data missing)
            if (!amc || amc === 'Other') {
                const name = item.scheme_name || '';
                const knownAMCs = [
                    'Aditya Birla', 'SBI', 'HDFC', 'ICICI Prudential', 'Axis', 'Kotak', 'Nippon India',
                    'UTI', 'Bandhan', 'IDFC', 'DSP', 'Mirae Asset', 'Tata', 'HSBC', 'Franklin Templeton',
                    'Sundaram', 'PGIM India', 'Invesco', 'LIC', 'Union', 'Quant', 'Parag Parikh', 'PPFAS',
                    'Edelweiss', 'Canara Robeco', 'Bajaj Finserv', 'Mahindra Manulife', '360 ONE',
                    'Trust', 'WhiteOak', 'Samco', 'Navi', 'Quantum', 'Motilal Oswal', 'Baroda BNP Paribas',
                    'JM Financial', 'Bank of India', 'Helios', 'Zerodha', 'Groww', 'Old Bridge'
                ];

                // Match longest known AMC name first
                const matched = knownAMCs.find(k => name.toLowerCase().includes(k.toLowerCase()));
                if (matched) {
                    amc = matched;
                } else {
                    // Priority 3: Basic Heuristic
                    if (name.includes(' - ')) {
                        amc = name.split(' - ')[0].replace(" Mutual Fund", "").trim();
                    } else {
                        amc = name.split(' ')[0];
                    }
                }
            }
            // Final safety
            if (!amc) amc = 'Other';

            amcAgg[amc] = (amcAgg[amc] || 0) + item.current_value;


            // 2. Calculate Asset & Category (from Category)
            const cat = item.category || 'Other';
            let asset = 'Other';
            let category = 'Other';

            // MFAPI Format: "Equity Scheme - Large Cap Fund"
            // AMFI Format: "Open Ended Schemes ( Equity Scheme - Large Cap Fund )"

            let cleanCat = cat;
            if (cat.includes('(')) {
                // Extract inner part: "Equity Scheme - Large Cap Fund"
                cleanCat = cat.split('(')[1].split(')')[0].trim();
            }

            if (cleanCat.includes(' - ')) {
                const parts = cleanCat.split(' - ');
                asset = parts[0].trim(); // "Equity Scheme"
                category = parts.pop().trim(); // "Large Cap Fund"
            } else {
                // Fallback
                category = cleanCat;
                asset = 'Other';
            }

            // Clean up Asset Name ("Equity Scheme" -> "Equity")
            asset = asset.replace(/ Scheme$/i, '');

            // Clean up Category Name ("Large Cap Fund" -> "Large Cap")
            category = category.replace(/ Fund$/i, '').replace(/ Scheme$/i, '');

            assetAgg[asset] = (assetAgg[asset] || 0) + item.current_value;
            sectorAgg[category] = (sectorAgg[category] || 0) + item.current_value;
        });

        const formatWithPercentage = (agg) => {
            const total = Object.values(agg).reduce((sum, val) => sum + val, 0);

            // 1. Convert to Array
            const data = Object.entries(agg).map(([name, value]) => ({
                name,
                value: Number(value) || 0, // Ensure number
                percentage: total > 0 ? (value / total) * 100 : 0
            }));

            // 2. Sort Descending by Value (Largest first)
            data.sort((a, b) => b.value - a.value);

            // 3. Format Name with Percentage (Post-sort)
            return data.map(item => ({
                name: `${item.name} (${item.percentage.toFixed(1)}%)`,
                value: item.value
            }));
        };

        return {
            amcData: formatWithPercentage(amcAgg),
            assetData: formatWithPercentage(assetAgg),
            sectorData: formatWithPercentage(sectorAgg)
        };
    }, [portfolio]);

    const analyzedInsights = useMemo(() => {
        if (!portfolio || !amcData.length) return null;
        return generatePortfolioInsights(portfolio, amcData, assetData, sectorData);
    }, [portfolio, amcData, assetData, sectorData]);

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

                <div className="flex items-center gap-2">
                    {/* Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                            className="bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 text-sm font-medium h-10 px-3 rounded-md inline-flex items-center gap-2 transition-colors"
                        >
                            <Filter className="h-4 w-4 text-slate-400" />
                            <span>
                                {filterType === 'all' && 'All Investments'}
                                {filterType === 'SIP' && 'SIP Only'}
                                {filterType === 'LUMPSUM' && 'Lumpsum Only'}
                            </span>
                            <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {dropdownOpen && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                <div className="px-3 py-2 border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Filter View
                                </div>
                                {[
                                    { label: 'All Investments', value: 'all' },
                                    { label: 'SIP Only', value: 'SIP' },
                                    { label: 'Lumpsum Only', value: 'LUMPSUM' }
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => {
                                            setFilterType(opt.value);
                                            setDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${filterType === opt.value
                                            ? 'bg-blue-600/10 text-blue-400'
                                            : 'text-slate-300 hover:bg-slate-800'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
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
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Total Invested</h3>
                        <IndianRupee className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-bold">₹{portfolio?.total_invested?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Current Value</h3>
                        <TrendingUp className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className={`text-2xl font-bold ${portfolio?.total_gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{portfolio?.total_current_value?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
                    </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Total Gain/Loss</h3>
                        <PieChartIcon className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className={`text-2xl font-bold ${portfolio?.total_gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolio?.total_gain >= 0 ? '+' : ''}₹{portfolio?.total_gain?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
                        <span className="text-sm font-medium opacity-80 ml-1">
                            ({((portfolio?.total_gain / portfolio?.total_invested) * 100).toFixed(2)}%)
                        </span>
                    </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow p-6 relative group">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium">Portfolio XIRR</h3>
                        <Percent className="h-4 w-4 text-slate-400 cursor-help" />
                    </div>
                    <div className={`text-2xl font-bold ${portfolio?.portfolio_xirr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolio?.portfolio_xirr?.toFixed(2)}%
                    </div>

                    {/* XIRR Tooltip */}
                    <div className="absolute top-FULL right-0 mt-2 w-64 p-3 bg-slate-950 border border-slate-700 rounded-lg shadow-xl text-xs text-slate-300 z-50 hidden group-hover:block">
                        <p className="font-semibold text-slate-100 mb-1">Extended Internal Rate of Return</p>
                        <p>Calculated using the Newton-Raphson method. Considers the exact timing of every cash flow (SIPs & Lumpsums) to determine the true annualized return.</p>
                    </div>
                </div>
            </div>

            {/* Portfolio IQ Section */}
            {analyzedInsights && (
                <div className="mb-6 rounded-xl border border-indigo-500/30 bg-indigo-950/10 text-slate-50 shadow-lg p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Sparkles className="h-32 w-32 text-indigo-400" />
                    </div>

                    <div className="flex items-center gap-2 mb-4 relative z-10">
                        <Sparkles className="h-5 w-5 text-indigo-400" />
                        <h3 className="text-lg font-bold text-indigo-100">Portfolio IQ</h3>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-mono font-bold border border-indigo-500/30">
                            SCORE: {analyzedInsights.score}/100
                        </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 relative z-10">
                        {analyzedInsights.items.map((item, idx) => {
                            const Icon =
                                item.icon === 'TrendingUp' ? TrendingUp :
                                    item.icon === 'Clock' ? Clock :
                                        item.icon === 'AlertCircle' ? AlertCircle :
                                            item.icon === 'PieChart' ? PieChartIcon :
                                                item.icon === 'Zap' ? Zap :
                                                    item.icon === 'Award' ? Award :
                                                        item.icon === 'ArrowDown' ? ArrowDown :
                                                            item.icon === 'TrendingDown' ? TrendingDown :
                                                                item.icon === 'Shield' ? Shield :
                                                                    item.icon === 'Umbrella' ? Umbrella : Sparkles;

                            const colors =
                                item.type === 'success' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                                    item.type === 'warning' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                                        item.type === 'danger' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                                            item.type === 'star' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                                                'text-blue-400 border-blue-500/30 bg-blue-500/10';

                            return (
                                <div key={idx} className={`rounded-lg border p-3 flex gap-3 items-start ${colors}`}>
                                    <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-sm opacity-90">{item.title}</h4>
                                        <p className="text-xs opacity-70 mt-1 leading-relaxed">{item.message}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Allocation Charts Row */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Asset Allocation Chart (New) */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow p-6 flex flex-col">
                    <h3 className="text-lg font-semibold mb-4">Asset Allocation</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={assetData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {assetData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value) => `₹${value.toLocaleString()}`}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    wrapperStyle={{ fontSize: '10px' }}
                                    payload={assetData.map((item, index) => ({
                                        id: item.name,
                                        type: 'square',
                                        value: item.name,
                                        color: COLORS[index % COLORS.length]
                                    }))}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Category Allocation Chart */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow p-6 flex flex-col">
                    <h3 className="text-lg font-semibold mb-4">Category Allocation</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={sectorData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {sectorData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value) => `₹${value.toLocaleString()}`}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    wrapperStyle={{ fontSize: '10px' }}
                                    payload={sectorData.map((item, index) => ({
                                        id: item.name,
                                        type: 'square',
                                        value: item.name,
                                        color: COLORS[index % COLORS.length]
                                    }))}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* AMC Allocation Chart */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow p-6 flex flex-col">
                    <h3 className="text-lg font-semibold mb-4">AMC Allocation</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={amcData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {amcData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value) => `₹${value.toLocaleString()}`}
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    wrapperStyle={{ fontSize: '10px' }}
                                    payload={amcData.map((item, index) => ({
                                        id: item.name,
                                        type: 'square',
                                        value: item.name,
                                        color: COLORS[index % COLORS.length]
                                    }))}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>


        </div>
    );
};

export default Dashboard;
