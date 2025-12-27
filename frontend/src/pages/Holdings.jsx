import { useState, useEffect, useMemo } from 'react';
import { getPortfolio, redeemInvestment, deleteScheme, getAccounts } from '../services/api';
import { RefreshCw, ChevronRight, ChevronDown, Layers, ChevronLeft, Info, ArrowUp, ArrowDown, BadgeDollarSign, Trash2, Filter, ArrowUpDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import RedeemModal from '../components/RedeemModal';
import ConfirmModal from '../components/ConfirmModal';
import PrivacyGuard from '../components/PrivacyGuard';

const Holdings = () => {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);

    // Grouping State
    const [groupBy, setGroupBy] = useState('none'); // 'none', 'amc', 'category', 'asset', 'account'
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [expandAll, setExpandAll] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Filtering State
    const [accounts, setAccounts] = useState([]);
    const [filterAccount, setFilterAccount] = useState('All');
    const [filterYear, setFilterYear] = useState('All');
    const [filterRedeem, setFilterRedeem] = useState('All');

    // XIRR Visibility State
    const [showXIRR, setShowXIRR] = useState(false);

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Redeem Modal State
    const [redeemModalOpen, setRedeemModalOpen] = useState(false);
    const [selectedHolding, setSelectedHolding] = useState(null);
    const [redeemLoading, setRedeemLoading] = useState(false);

    // Active/Sold Tab State
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'sold'

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState({
        isOpen: false,
        schemeCode: null,
        schemeName: ''
    });

    // Reset pagination when grouping or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [groupBy, filterAccount, filterYear, filterRedeem]);

    // Reset filters when tab changes
    useEffect(() => {
        setFilterYear('All');
        setFilterRedeem('All');
    }, [activeTab]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleOpenRedeem = (item) => {
        setSelectedHolding(item);
        setRedeemModalOpen(true);
    };

    const handleRedeemSubmit = async (data) => {
        setRedeemLoading(true);
        const toastId = toast.loading('Redeeming units...');
        try {
            await redeemInvestment(data);
            toast.success('Redemption successful!', { id: toastId });
            setRedeemModalOpen(false);
            fetchPortfolio(); // Refresh
        } catch (error) {
            console.error('Redemption failed', error);
            toast.error('Redemption failed', { id: toastId });
        } finally {
            setRedeemLoading(false);
        }
    };

    const handleDeleteClick = (scheme) => {
        setDeleteModal({
            isOpen: true,
            schemeCode: scheme.scheme_code,
            schemeName: scheme.scheme_name
        });
    };

    const handleConfirmDelete = async () => {
        try {
            await deleteScheme(deleteModal.schemeCode);
            toast.success("Scheme history deleted");
            setDeleteModal({ isOpen: false, schemeCode: null, schemeName: '' });
            fetchPortfolio(); // Refresh data
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete scheme");
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
        fetchPortfolio();
        getAccounts().then(({ data }) => setAccounts(data)).catch(err => console.error(err));
    }, []);

    // Effect to handle Expand All toggle
    useEffect(() => {
        if (expandAll && groupedData) {
            setExpandedGroups(new Set(Object.keys(groupedData)));
        } else {
            setExpandedGroups(new Set());
        }
    }, [expandAll]);

    // Helper: Calculate Financial Year
    const getFinancialYear = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        const month = date.getMonth(); // 0-11. April is 3.
        const year = date.getFullYear();

        let fyStart = year;
        if (month < 3) { // Jan, Feb, Mar belong to previous FY start year
            fyStart = year - 1;
        }
        const fyEnd = (fyStart + 1).toString().slice(-2);
        return `FY ${fyStart}-${fyEnd}`;
    };

    // Derived Data: Filtered Holdings (Base for both grouping and summary)
    const filteredHoldings = useMemo(() => {
        if (!portfolio?.holdings) return [];
        return portfolio.holdings.filter(item => {
            // Filter based on activeTab (Active vs Sold)
            const isActive = item.total_units > 0;
            // Sold tab should include:
            // 1. Fully sold items (0 units left, but has P&L/Value history)
            // 2. Partial sales (units > 0, but has realized P&L or realized value from past sales)
            const isSold = (item.total_units === 0 || item.total_units_sold > 0) && (item.realized_pnl !== 0 || item.realized_value > 0);

            if (activeTab === 'active' && !isActive) return false;
            if (activeTab === 'sold' && !isSold) return false;

            // Account Filter Logic
            const itemAccount = item.account_name || 'Default';
            if (filterAccount !== 'All' && itemAccount !== filterAccount) return false;

            // Year Filter Logic (Only for Sold tab) - NOW FINANCIAL YEAR
            if (activeTab === 'sold' && filterYear !== 'All') {
                if (!item.last_sell_date) return false;
                const itemFy = getFinancialYear(item.last_sell_date);
                if (itemFy !== filterYear) return false;
            }

            // Redeem Status Filter Logic (Only for Active tab)
            if (activeTab === 'active' && filterRedeem !== 'All') {
                const status = calculateRedeemStatus(item);
                // For filter, we check if it matches the general year or 'N'
                if (filterRedeem === 'N' && status === 'N') return true;
                if (filterRedeem === status) return true;
                return false;
            }

            return true;
        });
    }, [portfolio, activeTab, filterAccount, filterYear, filterRedeem]);

    // Derived Data: Available Years for Sold Tab - NOW FINANCIAL YEAR
    const availableYears = useMemo(() => {
        if (!portfolio?.holdings) return [];
        const years = new Set();
        portfolio.holdings.forEach(item => {
            if (item.last_sell_date) {
                const fy = getFinancialYear(item.last_sell_date);
                if (fy) years.add(fy);
            }
        });
        return Array.from(years).sort().reverse(); // Sort Descending string (FY 2025... > FY 2024...)
    }, [portfolio]);

    // Derived Data: Summary Metrics
    const summaryMetrics = useMemo(() => {
        const metrics = {
            totalInvested: 0,
            totalCurrent: 0,
            totalRealizedPnl: 0,
            totalRealizedValue: 0,
            sipCount: 0,
            lumpsumCount: 0
        };

        filteredHoldings.forEach(item => {
            if (activeTab === 'sold') {
                metrics.totalInvested += item.gross_invested_amount || 0;
                metrics.totalCurrent += item.realized_value || 0;
            } else {
                metrics.totalInvested += item.invested_amount;
                metrics.totalCurrent += item.current_value;
            }
            metrics.totalRealizedPnl += item.realized_pnl || 0;
            metrics.totalRealizedValue += item.realized_value || 0;

            if (item.is_sip) metrics.sipCount++;
            else metrics.lumpsumCount++;
        });

        // ROI Calculation
        const absReturn = metrics.totalCurrent - metrics.totalInvested;
        const returnPerc = metrics.totalInvested > 0
            ? (absReturn / metrics.totalInvested) * 100
            : 0;

        return { ...metrics, absReturn, returnPerc };
    }, [filteredHoldings]);

    // Derived Data: Grouping Logic
    const groupedData = useMemo(() => {
        if (!filteredHoldings.length || groupBy === 'none') return null;

        const groups = {};

        filteredHoldings.forEach(item => {
            // Already filtered, just group now

            let key = 'Other';

            // 1. Group By AMC
            if (groupBy === 'amc') {
                let amc = item.fund_house
                    ? item.fund_house.replace(" Mutual Fund", "").trim()
                    : null;

                if (!amc || amc === 'Other') {
                    // Smart Fallback (copied from Dashboard)
                    const name = item.scheme_name || '';
                    const knownAMCs = [
                        'Aditya Birla', 'SBI', 'HDFC', 'ICICI Prudential', 'Axis', 'Kotak', 'Nippon India', 'UTI', 'Bandhan', 'IDFC', 'DSP', 'Mirae Asset', 'Tata', 'HSBC', 'Franklin Templeton', 'Sundaram', 'PGIM India', 'Invesco', 'LIC', 'Union', 'Quant', 'Parag Parikh', 'PPFAS', 'Edelweiss', 'Canara Robeco', 'Bajaj Finserv', 'Mahindra Manulife', '360 ONE', 'Trust', 'WhiteOak', 'Samco', 'Navi', 'Quantum', 'Motilal Oswal', 'Baroda BNP Paribas', 'JM Financial', 'Bank of India', 'Helios', 'Zerodha', 'Groww', 'Old Bridge'
                    ];
                    const matched = knownAMCs.find(k => name.toLowerCase().includes(k.toLowerCase()));
                    amc = matched || (name.includes(' - ') ? name.split(' - ')[0] : name.split(' ')[0]);
                }
                key = amc || 'Other';
            }
            // 2. Group By Category or Asset
            else if (groupBy === 'category' || groupBy === 'asset') {
                const cat = item.category || 'Other';
                let cleanCat = cat.includes('(') ? cat.split('(')[1].split(')')[0].trim() : cat;

                if (groupBy === 'asset') {
                    // Asset Class (Equity, Debt)
                    if (cleanCat.includes(' - ')) key = cleanCat.split(' - ')[0].trim().replace(/ Scheme$/i, '');
                    else key = 'Other';
                } else {
                    // Sub-Category (Large Cap, Liquid)
                    if (cleanCat.includes(' - ')) key = cleanCat.split(' - ').pop().trim().replace(/ Fund$/i, '').replace(/ Scheme$/i, '');
                    else key = cleanCat;
                }
            }
            // 3. Group By Account
            else if (groupBy === 'account') {
                key = item.account_name || 'Default';
            }

            if (!groups[key]) {
                groups[key] = {
                    items: [],
                    totalInvested: 0,
                    totalCurrent: 0,
                    totalRealizedPnl: 0,
                    totalRealizedValue: 0,
                    totalBoughtCost: 0 // For calculating Sold Return %
                };
            }
            groups[key].items.push(item);
            groups[key].totalInvested += item.invested_amount;
            groups[key].totalGrossInvested = (groups[key].totalGrossInvested || 0) + (item.gross_invested_amount || 0);
            groups[key].totalCurrent += item.current_value;
            groups[key].totalRealizedPnl += item.realized_pnl || 0;
            groups[key].totalRealizedValue += item.realized_value || 0;
            // For sold return %, we need total cost of mixed items?
            // Or just sum realized pnl / sum cost?
            // Cost of sold items = realized_value - realized_pnl
            const costOfSold = (item.realized_value || 0) - (item.realized_pnl || 0);
            groups[key].totalBoughtCost += costOfSold;
        });

        // Calculate Return % for each group
        Object.keys(groups).forEach(key => {
            const group = groups[key];

            // Active Return
            const invested = group.totalInvested;
            const current = group.totalCurrent;
            group.returnPercentage = invested > 0
                ? ((current - invested) / invested) * 100
                : 0;

            // Sold Return (Total Realized P&L / Total Cost of Sold Items)
            // Or (Total Realized / Total Cost - 1) * 100
            group.totalRealizedPnlPercentage = group.totalBoughtCost > 0
                ? (group.totalRealizedPnl / group.totalBoughtCost) * 100
                : 0;
        });

        // Sort groups by total current value (descending)
        return Object.fromEntries(
            Object.entries(groups).sort(([, a], [, b]) => b.totalCurrent - a.totalCurrent)
        );
    }, [filteredHoldings, groupBy]);

    // Pagination Logic
    const paginatedData = useMemo(() => {
        let allItems = [];

        // Helper to sort an array of items
        const sortItems = (items) => {
            if (!sortConfig.key) return items;

            return [...items].sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                // Handle nulls
                if (aVal === null) return 1;
                if (bVal === null) return -1;

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        };



        if (groupBy === 'none') {
            // Directly use filteredHoldings
            allItems = sortItems(filteredHoldings);
        } else if (groupedData) {
            // Flatten groups
            allItems = Object.entries(groupedData).map(([groupName, group]) => {
                return [groupName, { ...group, items: sortItems(group.items) }];
            }).filter(Boolean);
        }

        const totalItems = allItems.length;
        const totalPages = Math.ceil(totalItems / rowsPerPage);
        const start = (currentPage - 1) * rowsPerPage;
        const currentItems = allItems.slice(start, start + rowsPerPage);

        return { currentItems, totalItems, totalPages };
    }, [filteredHoldings, groupedData, groupBy, currentPage, rowsPerPage, sortConfig]);

    const toggleGroup = (groupName) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupName)) next.delete(groupName);
            else next.add(groupName);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-slate-400">Loading Holdings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Holdings</h2>
                    <p className="text-slate-400 mt-1">
                        Detailed view of your current investment portfolio.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Expand All Toggle (Only when grouped) */}
                    {groupBy !== 'none' && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-400">Expand All</span>
                            <button
                                onClick={() => setExpandAll(!expandAll)}
                                className={`w-9 h-5 rounded-full relative transition-colors ${expandAll ? 'bg-blue-600' : 'bg-slate-700'}`}
                            >
                                <span className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${expandAll ? 'translate-x-4' : ''}`} />
                            </button>
                        </div>
                    )}

                    {/* XIRR Toggle */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">XIRR</span>
                        <button
                            onClick={() => setShowXIRR(!showXIRR)}
                            className={`w-9 h-5 rounded-full relative transition-colors ${showXIRR ? 'bg-blue-600' : 'bg-slate-700'}`}
                        >
                            <span className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${showXIRR ? 'translate-x-4' : ''}`} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 relative">
                        <Layers className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-400">Group:</span>

                        <div className="relative">
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                                className="flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white transition-colors outline-none"
                            >
                                <span>
                                    {groupBy === 'none' && 'None'}
                                    {groupBy === 'category' && 'Category'}
                                    {groupBy === 'amc' && 'AMC'}
                                    {groupBy === 'asset' && 'Asset Class'}
                                    {groupBy === 'account' && 'Account'}
                                </span>
                                <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {dropdownOpen && (
                                <div className="absolute top-full right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 overflow-hidden">
                                    {[
                                        { label: 'None', value: 'none' },
                                        { label: 'Category', value: 'category' },
                                        { label: 'AMC', value: 'amc' },
                                        { label: 'Asset Class', value: 'asset' },
                                        { label: 'Account', value: 'account' }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                setGroupBy(opt.value);
                                                setExpandAll(false);
                                                setDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${groupBy === opt.value
                                                ? 'bg-blue-600/10 text-blue-400'
                                                : 'text-slate-200 hover:bg-slate-700'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Account Filter Dropdown */}
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5">
                        <Filter className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-400">Filter:</span>
                        <select
                            value={filterAccount}
                            onChange={(e) => setFilterAccount(e.target.value)}
                            className="bg-transparent text-sm font-medium text-slate-200 outline-none cursor-pointer hover:text-white"
                        >
                            <option value="All" className="bg-slate-800">All Accounts</option>
                            <option value="Default" className="bg-slate-800">Default</option>
                            {accounts.map(acc => {
                                const val = typeof acc === 'object' ? acc.name : acc;
                                if (val === 'Default') return null;
                                return <option key={val} value={val} className="bg-slate-800">{val}</option>;
                            })}
                        </select>
                    </div>

                    {/* Redeem Status Filter (Only when activeTab is active) */}
                    {activeTab === 'active' && (
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5">
                            <Filter className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-400">Redeem:</span>
                            <select
                                value={filterRedeem}
                                onChange={(e) => setFilterRedeem(e.target.value)}
                                className="bg-transparent text-sm font-medium text-slate-200 outline-none cursor-pointer hover:text-white"
                            >
                                <option value="All" className="bg-slate-800">All</option>
                                <option value="N" className="bg-slate-800 text-red-400">N (&lt;12m)</option>
                                <option value="Year 1" className="bg-slate-800 text-emerald-400">Year 1</option>
                                <option value="Year 2" className="bg-slate-800 text-emerald-400">Year 2</option>
                                <option value="Year 3" className="bg-slate-800 text-emerald-400">Year 3</option>
                                <option value="Year 4" className="bg-slate-800 text-emerald-400">Year 4</option>
                                <option value="Year 5+" className="bg-slate-800 text-emerald-400">Year 5+</option>
                            </select>
                        </div>
                    )}
                    {/* Redeem Year Filter (Only when activeTab is sold) */}
                    {activeTab === 'sold' && (
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5">
                            <Filter className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-400">Year:</span>
                            <select
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                                className="bg-transparent text-sm font-medium text-slate-200 outline-none cursor-pointer hover:text-white"
                            >
                                <option value="All" className="bg-slate-800">All Years</option>
                                {availableYears.map(year => (
                                    <option key={year} value={year} className="bg-slate-800">{year}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-lg w-fit border border-slate-800/50 mb-6">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'active'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    Active Holdings
                </button>
                <button
                    onClick={() => setActiveTab('sold')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'sold'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    Exited / Sold
                </button>
            </div>

            {/* Summary Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">SIPs</p>
                    <p className="text-xl font-semibold text-slate-200 mt-1"><PrivacyGuard>{summaryMetrics.sipCount}</PrivacyGuard></p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Lumpsums</p>
                    <p className="text-xl font-semibold text-slate-200 mt-1"><PrivacyGuard>{summaryMetrics.lumpsumCount}</PrivacyGuard></p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Invested</p>
                    <p className="text-xl font-semibold text-slate-200 mt-1"><PrivacyGuard>₹{summaryMetrics.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</PrivacyGuard></p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">
                        {activeTab === 'sold' ? 'Exited Value' : 'Current'}
                    </p>
                    <p className="text-xl font-semibold text-blue-400 mt-1"><PrivacyGuard>₹{summaryMetrics.totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</PrivacyGuard></p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">
                        {activeTab === 'sold' ? 'Realized P&L' : 'Return'}
                    </p>
                    <p className={`text-xl font-semibold mt-1 ${summaryMetrics.absReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <PrivacyGuard>{summaryMetrics.absReturn >= 0 ? '+' : '-'}₹{Math.abs(summaryMetrics.absReturn).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</PrivacyGuard>
                    </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Return %</p>
                    <p className={`text-xl font-semibold mt-1 ${summaryMetrics.returnPerc >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <PrivacyGuard>{summaryMetrics.returnPerc >= 0 ? '+' : ''}{summaryMetrics.returnPerc.toFixed(2)}%</PrivacyGuard>
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow overflow-hidden flex flex-col">
                <div className="relative w-full overflow-auto flex-1">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b bg-slate-950/50 sticky top-0">
                            <tr className="border-b border-slate-800">
                                <th onClick={() => handleSort('scheme_name')} className="h-12 px-4 text-left align-middle font-medium text-slate-400 w-[30%] cursor-pointer hover:text-slate-200 group">
                                    <div className="flex items-center gap-1">
                                        Scheme
                                        {sortConfig.key === 'scheme_name' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 text-blue-500" /> : <ArrowDown className="h-4 w-4 text-blue-500" />
                                        )}
                                    </div>
                                </th>
                                {activeTab === 'active' ? (
                                    <>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-slate-400">
                                            <div className="flex items-center gap-1">
                                                Date
                                                <Info className="h-3.5 w-3.5 text-slate-500" />
                                            </div>
                                        </th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-slate-400">
                                            <div className="flex items-center gap-1 group relative w-fit cursor-help">
                                                Duration
                                                <Info className="h-3.5 w-3.5 text-slate-500" />
                                                {/* Tooltip */}
                                                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all">
                                                    <div className="text-xs space-y-2 text-slate-300 font-normal normal-case">
                                                        <div className="border-b border-slate-700 pb-1 mb-1 font-semibold text-slate-200">Values Explained</div>
                                                        <div className="grid grid-cols-[50px_1fr] gap-2">
                                                            <span className="text-slate-400">Plan:</span>
                                                            <span>Your target holding period.</span>
                                                            <span className="text-slate-400">Idle:</span>
                                                            <span>Time elapsed since investment.</span>
                                                            <span className="text-slate-400">Redeem:</span>
                                                            <span>
                                                                Withdrawal timeline.
                                                                <br />
                                                                <span className="text-red-400">N</span> = Less than 12m
                                                                <br />
                                                                <span className="text-emerald-400">Year X</span> = Held for X years
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {/* Arrow */}
                                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 border-t border-l border-slate-700 rotate-45"></div>
                                                </div>
                                            </div>
                                        </th>
                                        <th className="h-12 px-4 text-right align-middle font-medium text-slate-400 cursor-pointer hover:text-slate-200">
                                            <div className="flex items-center justify-end gap-1">
                                                Amount
                                            </div>
                                        </th>
                                        <th className="h-12 px-4 text-right align-middle font-medium text-slate-400 cursor-pointer hover:text-slate-200">
                                            <div className="flex items-center justify-end gap-1">
                                                Returns
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('max_52w')} className="h-12 px-4 text-center align-middle font-medium text-slate-400 cursor-pointer hover:text-slate-200">
                                            <div className="flex items-center justify-center gap-1">
                                                52W H/L
                                                {sortConfig.key === 'max_52w' && (
                                                    sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 text-blue-500" /> : <ArrowDown className="h-4 w-4 text-blue-500" />
                                                )}
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('max_since_invested')} className="h-12 px-4 text-center align-middle font-medium text-slate-400 cursor-pointer hover:text-slate-200">
                                            <div className="flex items-center justify-center gap-1">
                                                Since Inv H/L
                                                {sortConfig.key === 'max_since_invested' && (
                                                    sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 text-blue-500" /> : <ArrowDown className="h-4 w-4 text-blue-500" />
                                                )}
                                            </div>
                                        </th>
                                        {showXIRR && (
                                            <th onClick={() => handleSort('xirr')} className="h-12 px-4 text-right align-middle font-medium text-slate-400 cursor-pointer hover:text-slate-200">
                                                <div className="flex items-center justify-end gap-1 group relative w-full">
                                                    <span className="flex items-center gap-1 cursor-help">
                                                        XIRR
                                                        <Info className="h-3.5 w-3.5 text-slate-500" />
                                                    </span>
                                                    {sortConfig.key === 'xirr' && (
                                                        sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 text-blue-500" /> : <ArrowDown className="h-4 w-4 text-blue-500" />
                                                    )}
                                                    {/* Tooltip */}
                                                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all text-left pointer-events-none">
                                                        <div className="text-xs space-y-2 text-slate-300 font-normal normal-case">
                                                            <div className="border-b border-slate-700 pb-1 mb-1 font-semibold text-slate-200">XIRR Calculation</div>
                                                            <p>
                                                                Extended Internal Rate of Return.
                                                                It calculates the annualised return for irregular investments (like SIPs) and redemptions.
                                                            </p>
                                                            <div className="grid grid-cols-[20px_1fr] gap-1 items-start">
                                                                <span className="text-green-500 font-bold">+</span>
                                                                <span>Profit (Annualised)</span>
                                                                <span className="text-red-500 font-bold">-</span>
                                                                <span>Loss (Annualised)</span>
                                                            </div>
                                                        </div>
                                                        {/* Arrow */}
                                                        <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-800 border-t border-l border-slate-700 rotate-45"></div>
                                                    </div>
                                                </div>
                                            </th>
                                        )}
                                        <th className="h-12 px-4 text-center align-middle font-medium text-slate-400">
                                            Action
                                        </th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-4 py-3 text-left font-medium text-slate-400">Exit Summary</th>
                                        <th className="px-4 py-3 text-left font-medium text-slate-400">Amount</th>
                                        <th className="px-4 py-3 text-center font-medium text-slate-400">Duration</th>
                                        <th className="px-4 py-3 text-center font-medium text-slate-400">Term</th>
                                        <th className="px-6 py-4 text-right cursor-pointer group" onClick={() => requestSort('realized_pnl')}>
                                            <div className="flex items-center justify-end gap-1">
                                                Realized P&L
                                                <ArrowUpDown className={`h-3 w-3 transition-opacity ${sortConfig.key === 'realized_pnl' ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover:opacity-50'}`} />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-center font-medium text-slate-400">Action</th>
                                    </>
                                )}
                            </tr>
                        </thead>

                        <tbody className="[&_tr:last-child]:border-0">
                            {/* FLAT LIST VIEW */}
                            {groupBy === 'none' && paginatedData.currentItems.map((item) => (
                                <Row
                                    key={item.scheme_code}
                                    item={item}
                                    showXIRR={showXIRR}
                                    onRedeem={() => handleOpenRedeem(item)}
                                    activeTab={activeTab}
                                    onDelete={() => handleDeleteClick(item)}
                                />
                            ))}

                            {/* GROUPED VIEW */}
                            {groupBy !== 'none' && paginatedData.currentItems.map(([groupName, group]) => (
                                <>
                                    {/* Group Header Row */}
                                    <tr
                                        key={`group-${groupName}`}
                                        onClick={() => toggleGroup(groupName)}
                                        className="bg-slate-900/80 cursor-pointer hover:bg-slate-800 border-b border-slate-800 select-none"
                                    >
                                        <td colSpan={activeTab === 'active' ? 3 : 2} className="p-4 align-middle font-semibold text-blue-400">
                                            <div className="flex items-center gap-2">
                                                {expandedGroups.has(groupName) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                {groupBy === 'account' ? <PrivacyGuard>{groupName}</PrivacyGuard> : groupName}
                                                <span className="text-xs text-slate-500 font-normal ml-2 bg-slate-800 px-2 py-0.5 rounded-full">
                                                    {group.items.length} Funds
                                                </span>
                                            </div>
                                        </td>
                                        {activeTab === 'active' && (
                                            <>
                                                <td className="p-4 align-middle text-right font-bold text-sm">
                                                    <div className="text-slate-300"><PrivacyGuard>₹{group.totalInvested.toLocaleString()}</PrivacyGuard></div>
                                                    <div className="text-slate-400 text-xs"><PrivacyGuard>₹{group.totalCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</PrivacyGuard></div>
                                                </td>
                                                <td className="p-4 align-middle text-right font-bold">
                                                    <div className={`${(group.totalCurrent - group.totalInvested) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        <PrivacyGuard>
                                                            {(group.totalCurrent - group.totalInvested) >= 0 ? '+' : ''}₹{Math.abs(group.totalCurrent - group.totalInvested).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                        </PrivacyGuard>
                                                    </div>
                                                    <span className={`text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 ${group.returnPercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        <PrivacyGuard>{group.returnPercentage >= 0 ? '+' : ''}{group.returnPercentage.toFixed(1)}%</PrivacyGuard>
                                                    </span>
                                                </td>
                                                <td className="p-4 align-middle text-right"></td> {/* 52W */}
                                                <td className="p-4 align-middle text-right"></td> {/* Since Inv */}
                                                {showXIRR && <td className="p-4 align-middle text-right"></td>}
                                            </>
                                        )}
                                        {activeTab === 'sold' && (
                                            <>
                                                <td className="p-4 align-middle text-right"></td> {/* For Exit Summary */}
                                                <td className="p-4 align-middle text-right font-bold text-slate-300 text-xs">
                                                    <div>Inv: <PrivacyGuard>₹{(group.totalGrossInvested || 0).toLocaleString()}</PrivacyGuard></div>
                                                    <div>Ext: <PrivacyGuard>₹{(group.totalRealizedValue || 0).toLocaleString()}</PrivacyGuard></div>
                                                </td>
                                                <td className="p-4 align-middle text-right"></td> {/* For Duration */}
                                                <td className="p-4 align-middle text-right"></td> {/* For Term */}
                                                <td className="p-4 align-middle text-right font-bold text-slate-200">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <PrivacyGuard><span>₹{group.totalRealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></PrivacyGuard>
                                                        <span className={`text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 ${group.totalRealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            <PrivacyGuard>{group.totalRealizedPnl >= 0 ? '+' : ''}{group.totalRealizedPnlPercentage.toFixed(1)}%</PrivacyGuard>
                                                        </span>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                        <td className="p-4 align-middle text-right"></td> {/* For Action */}
                                    </tr>

                                    {/* Child Rows */}
                                    {expandedGroups.has(groupName) && group.items.map(item => (
                                        <Row
                                            key={item.scheme_code}
                                            item={item}
                                            isChild
                                            showXIRR={showXIRR}
                                            onRedeem={() => handleOpenRedeem(item)}
                                            activeTab={activeTab}
                                            onDelete={() => handleDeleteClick(item)}
                                        />
                                    ))}
                                </>
                            ))}

                            {(!portfolio?.holdings || portfolio.holdings.length === 0) && (
                                <tr>
                                    <td colSpan={showXIRR ? 8 : 7} className="p-4 text-center text-slate-400">No holdings found. Start investing!</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div >

                {/* Pagination Controls */}
                < div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 bg-slate-950/30" >
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Rows per page:</span>
                        <select
                            value={rowsPerPage}
                            onChange={(e) => {
                                setRowsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block p-1"
                        >
                            {[5, 10, 20, 30, 40].map(pageSize => (
                                <option key={pageSize} value={pageSize}>{pageSize}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400">
                            Page {currentPage} of {paginatedData.totalPages || 1}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1 rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(paginatedData.totalPages, p + 1))}
                                disabled={currentPage === paginatedData.totalPages}
                                className="p-1 rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div >
            </div >

            <RedeemModal
                isOpen={redeemModalOpen}
                onClose={() => setRedeemModalOpen(false)}
                onRedeem={handleRedeemSubmit}
                holding={selectedHolding}
                loading={redeemLoading}
            />

            <ConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                onConfirm={handleConfirmDelete}
                title="Delete Scheme History"
                message={`Are you sure you want to delete all history for "${deleteModal.schemeName}"? This action cannot be undone and will affect your Realized P&L.`}
            />
        </div >
    );
};

// Reusable Row Component
const Row = ({ item, isChild = false, showXIRR, onRedeem, activeTab = 'active', onDelete }) => (
    <tr className={`border-b border-slate-800 transition-colors hover:bg-slate-800/50 ${isChild ? 'bg-slate-900/30' : ''}`}>
        <td className={`p-4 align-middle font-medium ${isChild ? 'pl-10 relative' : ''}`}>
            {isChild && (
                <div className="absolute left-6 top-1/2 -translate-y-1/2 w-2 h-px bg-slate-600"></div>
            )}
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <span><PrivacyGuard>{item.scheme_name}</PrivacyGuard></span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    {item.is_sip && (
                        <PrivacyGuard>
                            <span className="text-[10px] bg-blue-400/20 text-orange-400 px-1.5 py-0.5 rounded font-bold tracking-wide">
                                SIP
                            </span>
                        </PrivacyGuard>
                    )}
                    <span className="text-xs text-slate-400">
                        {activeTab === 'active'
                            ? <span>Units: <PrivacyGuard>{item.total_units.toFixed(2)}</PrivacyGuard> | Avg NAV: <PrivacyGuard>₹{item.average_nav.toFixed(1)}</PrivacyGuard> | Cur NAV: <PrivacyGuard>₹{item.current_nav.toFixed(2)}</PrivacyGuard> <span className="text-slate-500">| <PrivacyGuard>{item.account_name || 'Default'}</PrivacyGuard></span></span>
                            : <span>Units: <PrivacyGuard>{(item.total_units_bought || 0).toFixed(2)}</PrivacyGuard> | Avg NAV: <PrivacyGuard>₹{(item.avg_buy_nav || 0).toFixed(1)}</PrivacyGuard> | Cur NAV: <PrivacyGuard>₹{item.current_nav.toFixed(2)}</PrivacyGuard> <span className="text-slate-500">| <PrivacyGuard>{item.account_name || 'Default'}</PrivacyGuard></span></span>
                        }
                    </span>
                </div>
            </div>
        </td>

        {activeTab === 'active' ? (
            <>
                <td className="p-4 align-middle text-left text-sm text-slate-300">
                    <div className="flex flex-col gap-1">
                        <div className="text-slate-300">
                            {/* Strategic Start (Mandate/Plan Start) or First Investment */}
                            {(item.plan_start_date || item.first_invested_date) ? <PrivacyGuard><span className="text-slate-400 text-xs">Start:</span> {new Date(item.plan_start_date || item.first_invested_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</PrivacyGuard> : '-'}
                        </div>
                        <div className="text-slate-300">
                            {/* Strategic Target Exit Date */}
                            {item.redemption_date ? <PrivacyGuard><span className="text-slate-400 text-xs text-amber-500/80">Target:</span> {new Date(item.redemption_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</PrivacyGuard> : (item.last_invested_date && <PrivacyGuard><span className="text-slate-400 text-xs">Last:</span> {new Date(item.last_invested_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</PrivacyGuard>)}
                        </div>
                    </div>
                </td>
                <td className="p-4 align-middle text-left text-sm text-slate-300">
                    <div className="flex flex-col gap-0.5">
                        {item.holding_period && (
                            <span className="text-[10px] text-slate-100 uppercase">Plan: {item.holding_period} yrs</span>
                        )}
                        {(() => {
                            // Use first_invested_date for duration calculation too
                            if (!item.first_invested_date) return <span>-</span>;

                            const start = new Date(item.first_invested_date);
                            const end = new Date();

                            // Calculate Idle Time for Display
                            let years = end.getFullYear() - start.getFullYear();
                            let months = end.getMonth() - start.getMonth();
                            let days = end.getDate() - start.getDate();

                            if (days < 0) {
                                months--;
                                const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
                                days += prevMonth.getDate();
                            }
                            if (months < 0) {
                                years--;
                                months += 12;
                            }

                            const redeemStatusFull = calculateRedeemStatus(item);
                            const isReady = redeemStatusFull !== 'N';

                            return (
                                <>
                                    <span className="text-[10px] text-slate-100 uppercase">
                                        Idle: {years}Y.{months}M.{days}D
                                    </span>
                                    <span className={`text-[10px] uppercase ${isReady ? 'text-emerald-400' : 'text-red-400'}`}>
                                        Redeem: {redeemStatusFull}
                                    </span>
                                </>
                            );
                        })()}
                    </div>
                </td>
                <td className="p-4 align-middle text-right font-medium text-sm">
                    <div className="text-slate-300"><PrivacyGuard>Inv: ₹{item.invested_amount.toLocaleString()}</PrivacyGuard></div>
                    <div className="text-slate-400 text-xs"><PrivacyGuard>Cur: ₹{item.current_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</PrivacyGuard></div>
                </td>
                <td className="p-4 align-middle text-right font-medium">
                    <div className={`${(item.current_value - item.invested_amount) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <PrivacyGuard>
                            {(item.current_value - item.invested_amount) >= 0 ? '+' : ''}₹{Math.abs(item.current_value - item.invested_amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </PrivacyGuard>
                    </div>
                    <div className={`text-xs ${item.return_percentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        <PrivacyGuard>{item.return_percentage >= 0 ? '+' : ''}{item.return_percentage.toFixed(1)}%</PrivacyGuard>
                    </div>
                </td>
                <td className="p-4 align-middle text-center text-xs text-slate-300">
                    {item.min_52w && item.max_52w ? (
                        <div className="flex flex-col gap-1 items-center">
                            <span className="">
                                ₹{item.min_52w.toFixed(1)}
                                {item.min_52w_date && <span className="text-[10px] text-slate-500 ml-1">({new Date(item.min_52w_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })})</span>}
                            </span>
                            <span className="">
                                ₹{item.max_52w.toFixed(1)}
                                {item.max_52w_date && <span className="text-[10px] text-slate-500 ml-1">({new Date(item.max_52w_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })})</span>}
                            </span>
                        </div>
                    ) : '-'}
                </td>
                <td className="p-4 align-middle text-center text-xs text-slate-300">
                    {item.min_since_invested && item.max_since_invested ? (
                        <div className="flex flex-col gap-1 items-center">
                            <span className="">
                                ₹{item.min_since_invested.toFixed(1)}
                                {item.min_since_invested_date && <span className="text-[10px] text-slate-500 ml-1">({new Date(item.min_since_invested_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })})</span>}
                            </span>
                            <span className="">
                                ₹{item.max_since_invested.toFixed(1)}
                                {item.max_since_invested_date && <span className="text-[10px] text-slate-500 ml-1">({new Date(item.max_since_invested_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })})</span>}
                            </span>
                        </div>
                    ) : '-'}
                </td>
                {showXIRR && (
                    <td className={`p-4 align-middle text-right font-bold ${item.xirr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.xirr ? item.xirr.toFixed(2) + '%' : '-'}
                    </td>
                )}

                <td className="p-4 align-middle text-center">
                    <button
                        onClick={onRedeem}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-slate-800"
                        title="Redeem / Sell"
                    >
                        <BadgeDollarSign className="h-4 w-4" />
                    </button>
                </td>
            </>
        ) : (
            <>
                {/* Sold Tab Columns */}
                <td className="p-4 align-middle text-left font-medium text-slate-300 text-xs">
                    <div>Units Sold: {item.total_units_sold?.toFixed(2) || '0.00'}</div>
                    <div className="text-slate-400">Sold NAV: ₹{item.avg_sold_nav?.toFixed(2) || '0.00'}</div>
                    <div className="text-slate-500">Cur NAV: ₹{item.current_nav?.toFixed(2) || '0.00'}</div>
                </td>
                <td className="p-4 align-middle text-left text-xs font-medium text-slate-300">
                    <div className="text-slate-400">Invested: ₹{(item.gross_invested_amount || 0).toLocaleString()}</div>
                    <div className="text-slate-400">Exited: ₹{(item.realized_value || 0).toLocaleString()}</div>
                </td>
                <td className="p-4 align-middle text-center text-xs text-slate-300">
                    <div className="flex flex-col gap-1 items-center">
                        <span className="text-slate-400">
                            {item.first_invested_date ? new Date(item.first_invested_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                            {' - '}
                            {item.last_sell_date ? new Date(item.last_sell_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                        </span>
                        {(() => {
                            if (!item.first_invested_date || !item.last_sell_date) return null;
                            const start = new Date(item.first_invested_date);
                            const end = new Date(item.last_sell_date);

                            let years = end.getFullYear() - start.getFullYear();
                            let months = end.getMonth() - start.getMonth();
                            let days = end.getDate() - start.getDate();

                            if (days < 0) {
                                months--;
                                const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
                                days += prevMonth.getDate();
                            }
                            if (months < 0) {
                                years--;
                                months += 12;
                            }

                            return (
                                <span className="text-[10px] text-slate-200 uppercase tracking-wide bg-slate-800 px-1.5 py-0.5 rounded">
                                    Idle: {years}Y.{months}M.{days}D
                                </span>
                            );
                        })()}
                    </div>
                </td>
                <td className="p-4 align-middle text-center">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${item.tax_status === 'Long Term' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'}`}>
                        {item.tax_status || 'Short Term'}
                    </span>
                </td>
                <td className={`p-4 align-middle text-right font-bold ${item.realized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ₹{item.realized_pnl?.toLocaleString() || '0'}
                </td>
                <td className="p-4 align-middle text-center">
                    <button
                        onClick={onDelete}
                        className="text-slate-500 hover:text-red-500 transition-colors p-1 rounded hover:bg-slate-800"
                        title="Delete History"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </td>
            </>
        )}
    </tr>
);

// Helper for Redeem Status
const calculateRedeemStatus = (item) => {
    // 1. Prioritize Backend Target Date (The Plan) -> REMOVED to show Tenure Progress (Year 1, Year 2...)
    // Users prefer seeing the age of the investment rather than a binary "Not Ready"
    // if (item.redemption_date) { ... }

    // 2. Fallback to original yearly threshold logic for Lumpsums without explicit mandates
    if (!item.first_invested_date) return "N";

    const start = new Date(item.first_invested_date);
    const end = new Date();
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
        months--;
        const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
        days += prevMonth.getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    const totalMonths = (years * 12) + months + (days / 30); // Approx

    if (totalMonths < 12) return "N";
    if (totalMonths <= 24) return "Year 1";
    if (totalMonths <= 36) return "Year 2";
    if (totalMonths <= 48) return "Year 3";
    if (totalMonths <= 60) return "Year 4";
    return "Year 5+";
};

export default Holdings;
