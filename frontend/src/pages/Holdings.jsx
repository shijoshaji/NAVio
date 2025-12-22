import { useState, useEffect, useMemo } from 'react';
import { getPortfolio } from '../services/api';
import { RefreshCw, ChevronRight, ChevronDown, Layers, ChevronLeft, Info, ArrowUp, ArrowDown } from 'lucide-react';

const Holdings = () => {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);

    // Grouping State
    const [groupBy, setGroupBy] = useState('none'); // 'none', 'amc', 'category', 'asset'
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [expandAll, setExpandAll] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // XIRR Visibility State
    const [showXIRR, setShowXIRR] = useState(false);

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Reset pagination when grouping changes
    useEffect(() => {
        setCurrentPage(1);
    }, [groupBy]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
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
    }, []);

    // Effect to handle Expand All toggle
    useEffect(() => {
        if (expandAll && groupedData) {
            setExpandedGroups(new Set(Object.keys(groupedData)));
        } else {
            setExpandedGroups(new Set());
        }
    }, [expandAll]);

    // Derived Data: Grouping Logic
    const groupedData = useMemo(() => {
        if (!portfolio?.holdings || groupBy === 'none') return null;

        const groups = {};

        portfolio.holdings.forEach(item => {
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

            if (!groups[key]) {
                groups[key] = {
                    items: [],
                    totalInvested: 0,
                    totalCurrent: 0,
                };
            }
            groups[key].items.push(item);
            groups[key].totalInvested += item.invested_amount;
            groups[key].totalCurrent += item.current_value;
        });

        // Calculate Return % for each group
        Object.keys(groups).forEach(key => {
            const invested = groups[key].totalInvested;
            const current = groups[key].totalCurrent;
            groups[key].returnPercentage = invested > 0
                ? ((current - invested) / invested) * 100
                : 0;
        });

        // Sort groups by total current value (descending)
        return Object.fromEntries(
            Object.entries(groups).sort(([, a], [, b]) => b.totalCurrent - a.totalCurrent)
        );
    }, [portfolio, groupBy]);

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
            allItems = sortItems(portfolio?.holdings || []);
        } else if (groupedData) {
            // In grouped view, we sort items WITHIN each group
            // We keep group order by total value (as per groupedData logic)
            // But we need to update the group items to be sorted
            allItems = Object.entries(groupedData).map(([groupName, group]) => {
                return [groupName, { ...group, items: sortItems(group.items) }];
            });
        }

        const totalItems = allItems.length;
        const totalPages = Math.ceil(totalItems / rowsPerPage);
        const start = (currentPage - 1) * rowsPerPage;
        const currentItems = allItems.slice(start, start + rowsPerPage);

        return { currentItems, totalItems, totalPages };
    }, [portfolio, groupedData, groupBy, currentPage, rowsPerPage, sortConfig]);

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
                        <span className="text-sm text-slate-400">Group by:</span>

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
                                </span>
                                <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {dropdownOpen && (
                                <div className="absolute top-full right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 overflow-hidden">
                                    {[
                                        { label: 'None', value: 'none' },
                                        { label: 'Category', value: 'category' },
                                        { label: 'AMC', value: 'amc' },
                                        { label: 'Asset Class', value: 'asset' }
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
                                <th onClick={() => handleSort('last_invested_date')} className="h-12 px-4 text-left align-middle font-medium text-slate-400 cursor-pointer hover:text-slate-200">
                                    <div className="flex items-center gap-1">
                                        Inv. Date
                                        {sortConfig.key === 'last_invested_date' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 text-blue-500" /> : <ArrowDown className="h-4 w-4 text-blue-500" />
                                        )}
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
                                <th onClick={() => handleSort('redemption_date')} className="h-12 px-4 text-left align-middle font-medium text-slate-400 cursor-pointer hover:text-slate-200">
                                    <div className="flex items-center gap-1">
                                        End Date
                                        {sortConfig.key === 'redemption_date' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 text-blue-500" /> : <ArrowDown className="h-4 w-4 text-blue-500" />
                                        )}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('invested_amount')} className="h-12 px-4 text-right align-middle font-medium text-slate-400 cursor-pointer hover:text-slate-200">
                                    <div className="flex items-center justify-end gap-1">
                                        Invested
                                        {sortConfig.key === 'invested_amount' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 text-blue-500" /> : <ArrowDown className="h-4 w-4 text-blue-500" />
                                        )}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('current_value')} className="h-12 px-4 text-right align-middle font-medium text-slate-400 cursor-pointer hover:text-slate-200">
                                    <div className="flex items-center justify-end gap-1">
                                        Current
                                        {sortConfig.key === 'current_value' && (
                                            sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4 text-blue-500" /> : <ArrowDown className="h-4 w-4 text-blue-500" />
                                        )}
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
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {/* FLAT LIST VIEW */}
                            {groupBy === 'none' && paginatedData.currentItems.map((item) => (
                                <Row key={item.scheme_code} item={item} showXIRR={showXIRR} />
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
                                        <td colSpan={4} className="p-4 align-middle font-semibold text-blue-400">
                                            <div className="flex items-center gap-2">
                                                {expandedGroups.has(groupName) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                {groupName}
                                                <span className="text-xs text-slate-500 font-normal ml-2 bg-slate-800 px-2 py-0.5 rounded-full">
                                                    {group.items.length} Funds
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle text-right font-bold text-slate-300">
                                            ₹{group.totalInvested.toLocaleString()}
                                        </td>
                                        <td className="p-4 align-middle text-right font-bold text-slate-200">
                                            <div className="flex flex-col items-end gap-1">
                                                <span>₹{group.totalCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                <span className={`text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 ${group.returnPercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {group.returnPercentage >= 0 ? '+' : ''}{group.returnPercentage.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle text-right"></td>
                                        {showXIRR && <td className="p-4 align-middle text-right"></td>}
                                    </tr>

                                    {/* Child Rows */}
                                    {expandedGroups.has(groupName) && group.items.map(item => (
                                        <Row key={item.scheme_code} item={item} isChild showXIRR={showXIRR} />
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
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 bg-slate-950/30">
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
                </div>
            </div>
        </div>
    );
};

// Reusable Row Component
const Row = ({ item, isChild = false, showXIRR }) => (
    <tr className={`border-b border-slate-800 transition-colors hover:bg-slate-800/50 ${isChild ? 'bg-slate-900/30' : ''}`}>
        <td className={`p-4 align-middle font-medium ${isChild ? 'pl-10 relative' : ''}`}>
            {isChild && (
                <div className="absolute left-6 top-1/2 -translate-y-1/2 w-2 h-px bg-slate-600"></div>
            )}
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <span>{item.scheme_name}</span>
                    {/* {item.is_sip && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold tracking-wide">
                            SIP
                        </span>
                    )} */}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    {item.is_sip && (
                        <span className="text-[10px] bg-blue-400/20 text-orange-400 px-1.5 py-0.5 rounded font-bold tracking-wide">
                            SIP
                        </span>
                    )}
                    <span className="text-xs text-slate-400">
                        Units: {item.total_units.toFixed(2)} | Avg NAV: ₹{item.average_nav.toFixed(1)} | Cur NAV: ₹{item.current_nav.toFixed(2)}
                    </span>
                </div>
            </div>
        </td>
        <td className="p-4 align-middle text-left text-sm text-slate-300">
            {item.last_invested_date ? new Date(item.last_invested_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
        </td>
        <td className="p-4 align-middle text-left text-sm text-slate-300">
            <div className="flex flex-col gap-0.5">
                {item.holding_period && (
                    <span className="text-[10px] text-slate-100 uppercase">Plan: {item.holding_period} yrs</span>
                )}
                {(() => {
                    if (!item.last_invested_date) return <span>-</span>;

                    const start = new Date(item.last_invested_date);
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

                    let redeemStatus = "N";
                    if (totalMonths < 12) redeemStatus = "N";
                    else if (totalMonths <= 24) redeemStatus = "Year 1";
                    else if (totalMonths <= 36) redeemStatus = "Year 2";
                    else if (totalMonths <= 48) redeemStatus = "Year 3";
                    else if (totalMonths <= 60) redeemStatus = "Year 4";
                    else redeemStatus = "Year 5+";

                    return (
                        <>
                            <span className="text-[10px] text-slate-100 uppercase">
                                Idle: {years}Y.{months}M.{days}D
                            </span>
                            <span className={`text-[10px] uppercase ${redeemStatus === 'N' ? 'text-red-400' : 'text-emerald-400'}`}>
                                Redeem: {redeemStatus}
                            </span>
                        </>
                    );
                })()}
            </div>
        </td>
        <td className="p-4 align-middle text-left text-sm text-slate-300">
            {item.redemption_date ? new Date(item.redemption_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
        </td>
        <td className="p-4 align-middle text-right font-medium">₹{item.invested_amount.toLocaleString()}</td>
        <td className="p-4 align-middle text-right font-medium">
            <div>₹{item.current_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className={`text-xs ${item.return_percentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {item.return_percentage >= 0 ? '+' : ''}{item.return_percentage.toFixed(1)}%
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
        {showXIRR && (
            <td className={`p-4 align-middle text-right font-bold ${item.xirr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {item.xirr ? item.xirr.toFixed(2) + '%' : '-'}
            </td>
        )}
    </tr>
);

export default Holdings;
