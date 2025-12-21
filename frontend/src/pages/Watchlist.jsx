import { useState, useEffect, useMemo } from 'react';
import { Plus, TrendingUp, FolderPlus, ArrowUpRight, ArrowDownRight, Target, Pencil, Trash2, X, Check, Save, AlertCircle, BadgeDollarSign, Ban, TrendingDown, Search, Tag, Edit2, ExternalLink, HelpCircle, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import {
    getWatchlist,
    addToWatchlist,
    getWatchlistGroups,
    createWatchlistGroup,
    updateWatchlistGroup,
    deleteWatchlistGroup,
    deleteWatchlistItem,
    markWatchlistItemSold,
    updateWatchlistDate
} from '../services/api';
import FundSelector from '../components/FundSelector';
import ConfirmModal from '../components/ConfirmModal';

const Watchlist = () => {
    // Data State
    const [watchlist, setWatchlist] = useState([]);
    const [groups, setGroups] = useState([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [activeGroupId, setActiveGroupId] = useState('all'); // 'all', 'ungrouped', or group ID
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null); // { id, name }
    const [editingItem, setEditingItem] = useState(null); // Item ID being edited
    const [sellingItem, setSellingItem] = useState(null); // Item being marked as sold
    const [subTab, setSubTab] = useState('active'); // 'active' | 'sold'
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    // Form State for Add/Edit
    const [selectedScheme, setSelectedScheme] = useState(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [formData, setFormData] = useState({
        group_id: '',
        target_nav: '',
        units: '',
        invested_amount: ''
    });

    // Form State for Sell
    const [sellData, setSellData] = useState({
        sold_nav: '',
        sold_date: new Date().toISOString().split('T')[0]
    });

    // Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        type: null, // 'DELETE_GROUP' | 'DELETE_ITEM'
        id: null,
        title: '',
        message: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    // Reset View State on Group Change
    useEffect(() => {
        setSubTab('active');
        setCurrentPage(1);
    }, [activeGroupId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [watchlistRes, groupsRes] = await Promise.all([
                getWatchlist(),
                getWatchlistGroups()
            ]);
            setWatchlist(watchlistRes.data);
            setGroups(groupsRes.data);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Group Management ---
    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;

        // Check for duplicate group name (case-insensitive)
        const isDuplicate = groups.some(group => group.name.toLowerCase() === newGroupName.trim().toLowerCase());
        if (isDuplicate) {
            toast.error('Group with this name already exists');
            return;
        }

        try {
            await createWatchlistGroup(newGroupName);
            setNewGroupName('');
            setShowCreateGroup(false);
            fetchData();
            toast.success('Group created successfully');
        } catch (error) {
            console.error("Failed to create group", error);
            toast.error('Failed to create group');
        }
    };

    const handleUpdateGroup = async (id, newName) => {
        if (!newName.trim()) return;
        try {
            await updateWatchlistGroup(id, newName);
            setEditingGroup(null);
            fetchData();
            toast.success('Group updated successfully');
        } catch (error) {
            console.error("Failed to update group", error);
            toast.error('Failed to update group');
        }
    };

    const handleDeleteGroup = (id) => {
        setConfirmModal({
            isOpen: true,
            type: 'DELETE_GROUP',
            id: id,
            title: 'Delete Group?',
            message: 'Are you sure you want to delete this group and ALL funds in it? This action cannot be undone.'
        });
    };

    const confirmDeleteGroup = async (id) => {
        try {
            await deleteWatchlistGroup(id);
            if (activeGroupId === id) setActiveGroupId('all');
            fetchData();
            toast.success('Group deleted successfully');
        } catch (error) {
            console.error("Failed to delete group", error);
            toast.error('Failed to delete group');
        }
    };

    // --- Item Management ---
    const handleDeleteItem = (id) => {
        setConfirmModal({
            isOpen: true,
            type: 'DELETE_ITEM',
            id: id,
            title: 'Remove Fund?',
            message: 'Are you sure you want to remove this fund from your watchlist?'
        });
    };

    const confirmDeleteItem = async (id) => {
        try {
            await deleteWatchlistItem(id);
            fetchData();
            toast.success('Scheme removed from watchlist');
        } catch (error) {
            console.error("Failed to delete item", error);
            toast.error('Failed to delete scheme');
        }
    };

    const handleConfirmAction = () => {
        if (confirmModal.type === 'DELETE_GROUP') {
            confirmDeleteGroup(confirmModal.id);
        } else if (confirmModal.type === 'DELETE_ITEM') {
            confirmDeleteItem(confirmModal.id);
        }
    };

    const openSellModal = (item) => {
        setSellingItem(item);
        setSellData({
            sold_nav: item.nav || '', // Default to current NAV
            sold_date: new Date().toISOString().split('T')[0]
        });
    };

    const handleSellConfirm = async () => {
        if (!sellingItem || !sellData.sold_nav) return;
        try {
            await markWatchlistItemSold(sellingItem.id, {
                sold_nav: parseFloat(sellData.sold_nav),
                sold_date: sellData.sold_date
            });
            setSellingItem(null);
            fetchData();
            toast.success(`Sold at NAV ₹${sellData.sold_nav} (Date: ${sellData.sold_date})`);
        } catch (error) {
            console.error("Sell failed", error);
            toast.error('Failed to mark as sold');
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!selectedScheme) {
            toast.error("Please select a fund");
            return;
        }

        // Check for duplicates (Active only)
        const targetGroupId = formData.group_id ? parseInt(formData.group_id) : null;
        const duplicate = watchlist.find(item =>
            item.scheme_code === selectedScheme.scheme_code &&
            item.group_id === targetGroupId &&
            !item.is_sold
        );

        if (duplicate) {
            toast.error("This fund is already active in this group.");
            return;
        }

        try {
            const payload = {
                scheme_code: selectedScheme.scheme_code,
                group_id: formData.group_id ? parseInt(formData.group_id) : null,
                target_nav: formData.target_nav ? parseFloat(formData.target_nav) : null,
                units: formData.units ? parseFloat(formData.units) : 0,
                invested_amount: formData.invested_amount ? parseFloat(formData.invested_amount) : 0
            };
            await addToWatchlist(payload);
            setSelectedScheme(null);
            setFormData({ group_id: '', target_nav: '', units: '', invested_amount: '' });
            fetchData();
            toast.success("Scheme added to watchlist.");
        } catch (error) {
            console.error("Add failed", error);
            toast.error("Failed to add scheme.");
        }
    };

    const startEditingItem = (item) => {
        setEditingItem(item.id);
        setFormData({
            group_id: item.group_id || '',
            target_nav: item.target_nav || '',
            units: item.units || '',
            invested_amount: item.invested_amount || '',
            added_on: item.added_on || ''
        });
    };

    const handleUpdateItem = async (schemeCode) => {
        try {
            const payload = {
                scheme_code: schemeCode,
                group_id: formData.group_id ? parseInt(formData.group_id) : null,
                target_nav: formData.target_nav ? parseFloat(formData.target_nav) : null,
                units: formData.units ? parseFloat(formData.units) : 0,
                invested_amount: formData.invested_amount ? parseFloat(formData.invested_amount) : 0
            };

            // 1. Update standard details
            await addToWatchlist(payload);

            // 2. Update Date if present (separate API)
            if (formData.added_on && editingItem) {
                await updateWatchlistDate(editingItem, formData.added_on);
            }

            setEditingItem(null);
            setFormData({ group_id: '', target_nav: '', units: '', invested_amount: '', added_on: '' });
            fetchData();
            toast.success("Scheme updated in watchlist.");
        } catch (error) {
            console.error("Update failed", error);
            toast.error("Failed to update.");
        }
    };

    // --- Derived State ---

    // 1. Filter by Group
    const groupItems = useMemo(() => {
        return watchlist.filter(item => {
            if (activeGroupId === 'all') return true;
            if (activeGroupId === 'ungrouped') return !item.group_id;
            return item.group_id === activeGroupId;
        });
    }, [watchlist, activeGroupId]);

    // 2. Filter by SubTab (Active vs Sold) AND specific logic
    const tabFilteredItems = useMemo(() => {
        return groupItems.filter(item => {
            // sold tab
            if (subTab === 'sold') return item.is_sold;

            // active tab
            if (item.is_sold) return false;

            // "All Funds" -> Active Tab: Keep the "Actionable Dashboard" logic?
            // User request: "under each group... active and sold tabs".
            // Let's relax "All Funds" -> Active to show ALL active, or keep it strict?
            // "Show only for add or sell conditions" was previous request.
            // But now with pagination, maybe seeing all is better?
            // Let's keep the Signal Logic for "All Funds" to keep it useful as a dashboard.
            if (activeGroupId === 'all') {
                // Re-calculating signals here for filter (or move signal logic up)
                const targetValue = item.units * (item.target_nav || 0);
                const averageNAV = item.units > 0 ? item.invested_amount / item.units : 0;
                const returnPct = averageNAV > 0 ? (item.nav - averageNAV) / averageNAV : 0;
                const valueDiff = targetValue - item.current_value;
                const isTargetHit = item.target_nav && item.nav >= item.target_nav;

                const showDipBuy = averageNAV > 0 && returnPct < -0.10;
                const showAccumulate = averageNAV > 0 && returnPct >= -0.10 && returnPct <= 0.10;
                const showTargetSell = !item.is_sold && (isTargetHit || valueDiff <= 0) && item.target_nav > 0 && item.invested_amount > 0;
                const showEarlySell = !item.is_sold && !showTargetSell && valueDiff > 0 && valueDiff <= 50 && item.target_nav > 0 && item.invested_amount > 0;

                // Always show "New/Watch" items (Invested = 0) so they don't disappear after adding
                if (item.invested_amount === 0) return true;

                return showDipBuy || showAccumulate || showTargetSell || showEarlySell;
            }

            return true; // For specific groups, show ALL active items
        });
    }, [groupItems, subTab, activeGroupId]);

    // 3. Pagination
    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return tabFilteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [tabFilteredItems, currentPage]);

    const totalPages = Math.ceil(tabFilteredItems.length / ITEMS_PER_PAGE);

    const calculateTotals = (items) => {
        return items.reduce((acc, item) => {
            if (item.is_sold) {
                // SOLD ITEMS: Contribute to Realised P&L only
                return {
                    ...acc,
                    realisedPL: acc.realisedPL + (item.gain_loss || 0),
                    realisedValue: acc.realisedValue + (item.current_value || 0), // current_value is sold_value for sold items logic
                    soldCount: acc.soldCount + 1,
                    count: acc.count + 1
                };
            } else {
                // ACTIVE ITEMS: Contribute to Portfolio Value & Target
                const targetVal = (item.units * (item.target_nav || 0));
                const validTarget = item.target_nav > 0;

                return {
                    ...acc,
                    invested: acc.invested + (item.invested_amount || 0),
                    currentValue: acc.currentValue + (item.current_value || 0),
                    targetValue: acc.targetValue + (validTarget ? targetVal : 0),
                    investedWithTarget: acc.investedWithTarget + (validTarget ? (item.invested_amount || 0) : 0),
                    activeCount: acc.activeCount + 1,
                    count: acc.count + 1
                };
            }
        }, {
            invested: 0, currentValue: 0, targetValue: 0, investedWithTarget: 0,
            realisedPL: 0, realisedValue: 0,
            count: 0, activeCount: 0, soldCount: 0
        });
    };

    const groupOverview = useMemo(() => {
        if (activeGroupId === 'all' || activeGroupId === 'ungrouped') return null;
        return calculateTotals(groupItems); // Use groupItems (all in group) for overview
    }, [groupItems, activeGroupId]);

    // Calculate totals for All Funds Graph (Includes Realised P&L for stats)
    const allFundsOverview = useMemo(() => {
        if (activeGroupId !== 'all') return null;
        return calculateTotals(watchlist);
    }, [watchlist, activeGroupId]);

    const chartData = useMemo(() => {
        if (!allFundsOverview) return [];
        return [
            { name: 'Invested', value: allFundsOverview.invested, fill: '#64748b' },
            { name: 'Current', value: allFundsOverview.currentValue, fill: '#3b82f6' },
            { name: 'Target', value: allFundsOverview.targetValue, fill: '#10b981' }
        ];
    }, [allFundsOverview]);

    const getGroupName = (id) => {
        const g = groups.find(x => x.id === id);
        return g ? g.name : 'Uncategorized';
    };

    // Custom Tooltip for Chart
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl">
                    <p className="font-semibold text-slate-200">{data.name}</p>
                    <p className="text-sm font-mono" style={{ color: data.fill }}>
                        ₹{data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Watchlist</h2>
                    <p className="text-slate-400 text-sm mt-1">Track funds and monitor customized portfolios</p>
                </div>
                <button
                    onClick={() => setShowCreateGroup(!showCreateGroup)}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white h-9 px-4 transition-colors"
                >
                    <FolderPlus className="mr-2 h-4 w-4" /> New Group
                </button>
            </div>

            {/* Create Group Modal/Inline */}
            {showCreateGroup && (
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex gap-4 items-end animate-in fade-in slide-in-from-top-2">
                    <div className="flex-1">
                        <label className="text-xs font-medium text-slate-400 mb-1 block">Group Name</label>
                        <input
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="e.g., High Risk, Tax Saving"
                            className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup(e)}
                        />
                    </div>
                    <button onClick={handleCreateGroup} className="h-9 px-4 rounded text-sm bg-blue-600 text-white hover:bg-blue-700 mx-2">Create</button>
                    <button onClick={() => setShowCreateGroup(false)} className="h-9 px-4 rounded text-sm text-slate-400 hover:text-white border border-slate-700">Cancel</button>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-slate-800">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    <button
                        onClick={() => setActiveGroupId('all')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeGroupId === 'all'
                            ? 'border-blue-500 text-blue-500'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                    >
                        All Funds
                    </button>
                    {groups.map((group) => (
                        <div key={group.id} className="flex items-center group relative">
                            {editingGroup && editingGroup.id === group.id ? (
                                <div className="flex items-center gap-1 py-3">
                                    <input
                                        type="text"
                                        value={editingGroup.name}
                                        onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                        className="h-7 w-32 bg-slate-950 border border-slate-700 rounded px-2 text-sm text-slate-50 focus:outline-none focus:border-blue-500"
                                        autoFocus
                                    />
                                    <button onClick={() => handleUpdateGroup(group.id, editingGroup.name)} className="text-green-500 hover:text-green-400"><Check className="h-4 w-4" /></button>
                                    <button onClick={() => setEditingGroup(null)} className="text-red-500 hover:text-red-400"><X className="h-4 w-4" /></button>
                                </div>
                            ) : (
                                <div className="flex items-center">
                                    <button
                                        onClick={() => setActiveGroupId(group.id)}
                                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeGroupId === group.id
                                            ? 'border-blue-500 text-blue-500'
                                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                            }`}
                                    >
                                        {group.name}
                                    </button>
                                    {activeGroupId === group.id && (
                                        <div className="ml-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingGroup({ id: group.id, name: group.name })} className="text-slate-500 hover:text-blue-400"><Pencil className="h-3 w-3" /></button>
                                            <button onClick={() => handleDeleteGroup(group.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>
            </div>

            {/* --- All Funds Graph Section --- */}
            {activeGroupId === 'all' && allFundsOverview && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Summary Text on Left/Top */}
                        <div className="md:w-1/3 space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-200">Portfolio Health</h3>
                                <p className="text-slate-500 text-sm">Total Performance across all groups</p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline border-b border-slate-800 pb-2">
                                    <span className="text-sm text-slate-500">Invested</span>
                                    <span className="text-lg font-mono text-slate-300">₹{allFundsOverview.invested.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-baseline border-b border-slate-800 pb-2">
                                    <span className="text-sm text-slate-500">Current</span>
                                    <div className="text-right">
                                        <div className="text-lg font-mono text-blue-400">₹{allFundsOverview.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div className={`text-xs font-medium ${allFundsOverview.currentValue >= allFundsOverview.invested ? 'text-green-500' : 'text-red-500'}`}>
                                            {allFundsOverview.currentValue >= allFundsOverview.invested ? '+' : ''}₹{(allFundsOverview.currentValue - allFundsOverview.invested).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            <span className="ml-1 opacity-75">
                                                ({((allFundsOverview.currentValue - allFundsOverview.invested) / allFundsOverview.invested * 100).toFixed(2)}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-baseline border-b border-slate-800 pb-2">
                                    <span className="text-sm text-slate-500">Target Goal</span>
                                    <div className="text-right">
                                        <div className="text-lg font-mono text-emerald-400">₹{allFundsOverview.targetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div className="text-xs font-medium text-emerald-500/80">
                                            +₹{(allFundsOverview.targetValue - allFundsOverview.investedWithTarget).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            <span className="ml-1 opacity-75">
                                                ({((allFundsOverview.targetValue - allFundsOverview.investedWithTarget) / allFundsOverview.investedWithTarget * 100).toFixed(2)}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-baseline border-b border-slate-800 pb-2">
                                    <span className="text-sm text-slate-500">Realised P&L</span>
                                    <div className="text-right">
                                        <div className={`text-lg font-mono ${allFundsOverview.realisedPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {allFundsOverview.realisedPL >= 0 ? '+' : ''}₹{allFundsOverview.realisedPL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {allFundsOverview.soldCount} exited funds
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chart on Right/Bottom */}
                        <div className="md:w-2/3 h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                    <XAxis type="number" stroke="#475569" tickFormatter={(value) => `₹${value / 1000}k`} />
                                    <YAxis dataKey="name" type="category" stroke="#94a3b8" width={60} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.4 }} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Sell Modal */}
            {sellingItem && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-sm space-y-4">
                        <h3 className="text-xl font-bold text-slate-50">Mark as Sold</h3>
                        <p className="text-sm text-slate-400">{sellingItem.scheme_name}</p>

                        <div>
                            <label className="text-xs font-medium text-slate-400 block mb-1">Sold NAV (Price)</label>
                            <input
                                type="number"
                                step="0.0001"
                                value={sellData.sold_nav}
                                onChange={(e) => setSellData({ ...sellData, sold_nav: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-50"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-400 block mb-1">Sold Date</label>
                            <input
                                type="date"
                                value={sellData.sold_date}
                                onChange={(e) => setSellData({ ...sellData, sold_date: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-50"
                            />
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <button onClick={() => setSellingItem(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                            <button onClick={handleSellConfirm} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium">Confirm Sold</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={handleConfirmAction}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText="Delete"
                isDanger={true}
            />

            <div className="grid gap-6 lg:grid-cols-3">
                {/* --- Add Fund Section (Only for All Funds) --- */}
                {activeGroupId === 'all' && (
                    <div className="lg:col-span-1 bg-slate-900 text-slate-50 rounded-lg border border-slate-800 shadow-sm h-fit">
                        <div className="p-6 border-b border-slate-800">
                            <h3 className="text-lg font-semibold flex items-center">
                                <Plus className="mr-2 h-5 w-5 text-blue-500" />
                                Add to Watchlist
                            </h3>
                        </div>
                        <form onSubmit={handleAdd} className="p-6 space-y-4">
                            <FundSelector onSelect={setSelectedScheme} selectedScheme={selectedScheme} />

                            {selectedScheme && (
                                <div className="space-y-4 pt-4 border-t border-slate-800 animate-in fade-in">
                                    {/* Group Selection */}
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 mb-1 block">Assign Group</label>
                                        <select
                                            value={formData.group_id}
                                            onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                                            className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Uncategorized</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-slate-400 mb-1 flex items-center">Target NAV <Target className="ml-1 h-3 w-3" /></label>
                                        <input
                                            type="number" step="0.01"
                                            value={formData.target_nav}
                                            onChange={(e) => setFormData({ ...formData, target_nav: e.target.value })}
                                            placeholder={`Current: ₹${selectedScheme.net_asset_value}`}
                                            className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-medium text-slate-400 mb-1 block">Units</label>
                                            <input
                                                type="number" step="0.001"
                                                value={formData.units}
                                                onChange={(e) => setFormData({ ...formData, units: e.target.value })}
                                                className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-400 mb-1 block">Invested Amt</label>
                                            <input
                                                type="number" step="1"
                                                value={formData.invested_amount}
                                                onChange={(e) => setFormData({ ...formData, invested_amount: e.target.value })}
                                                className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700">Add to Watchlist</button>
                                </div>
                            )}
                        </form>
                    </div>
                )}

                {/* --- Group Overview (Only for specific groups) --- */}
                {groupOverview && (
                    <div className="lg:col-span-3 bg-slate-800/50 rounded-lg border border-slate-700/50 p-6 mb-0">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-50">{getGroupName(activeGroupId)} Overview</h3>
                                <p className="text-slate-400 text-sm">{groupOverview.count} Funds Tracking <span className="text-slate-500">({groupOverview.activeCount} Active · {groupOverview.soldCount} Sold)</span></p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {/* 1. Invested (Active Only) */}
                            <div>
                                <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Active Invested</div>
                                <div className="text-2xl font-mono text-slate-200">₹{groupOverview.invested.toLocaleString()}</div>
                            </div>

                            {/* 2. Current Value (Active Only) */}
                            <div>
                                <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Active Current</div>
                                <div className="text-2xl font-mono text-slate-50">₹{groupOverview.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <div className={`text-sm mt-1 font-medium ${groupOverview.currentValue - groupOverview.invested >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {(groupOverview.currentValue - groupOverview.invested) >= 0 ? '+' : ''}
                                    {(groupOverview.currentValue - groupOverview.invested).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    <span className="ml-1 opacity-75">
                                        ({(groupOverview.invested > 0 ? ((groupOverview.currentValue - groupOverview.invested) / groupOverview.invested * 100) : 0).toFixed(2)}%)
                                    </span>
                                </div>
                            </div>

                            {/* 3. Target Value (Active Only) */}
                            <div>
                                <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Target Goal</div>
                                <div className="text-2xl font-mono text-slate-300">₹{groupOverview.targetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <div className={`text-sm mt-1 font-medium ${groupOverview.targetValue - groupOverview.investedWithTarget >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(groupOverview.targetValue - groupOverview.investedWithTarget) >= 0 ? '+' : ''}
                                    {(groupOverview.targetValue - groupOverview.investedWithTarget).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    <span className="ml-1 opacity-75">
                                        ({(groupOverview.investedWithTarget > 0 ? ((groupOverview.targetValue - groupOverview.investedWithTarget) / groupOverview.investedWithTarget * 100) : 0).toFixed(2)}%)
                                    </span>
                                </div>
                            </div>

                            {/* 4. Realised P&L (Sold Only) */}
                            <div className="bg-slate-900/40 -m-2 p-4 rounded border border-slate-700/50">
                                <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Realised P&L</div>
                                <div className={`text-2xl font-mono ${groupOverview.realisedPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {groupOverview.realisedPL >= 0 ? '+' : ''}₹{groupOverview.realisedPL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    From {groupOverview.soldCount} exited funds
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- Sub Tabs (Active / Sold) - Hide for "All Funds" --- */}
                {activeGroupId !== 'all' && (
                    <div className="flex justify-center md:justify-start border-b border-slate-800">
                        <button
                            onClick={() => { setSubTab('active'); setCurrentPage(1); }}
                            className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${subTab === 'active' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                        >
                            Active Positions
                        </button>
                        <button
                            onClick={() => { setSubTab('sold'); setCurrentPage(1); }}
                            className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${subTab === 'sold' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                        >
                            Realised (Sold)
                        </button>
                    </div>
                )}

                {/* --- Funds List --- */}
                <div className={`space-y-4 ${activeGroupId === 'all' ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                    {paginatedItems.length === 0 ? (
                        <div className="text-center text-slate-400 py-20 border border-dashed border-slate-800 rounded-lg">
                            <p>No {subTab} funds found.</p>
                            {activeGroupId !== 'all' && subTab === 'active' && <p className="text-sm mt-1">Go to "All Funds" to add funds to this group.</p>}
                        </div>
                    ) : (
                        paginatedItems.map((item) => {
                            const isEditing = editingItem === item.id;

                            // Edit Mode Card
                            if (isEditing) {
                                return (
                                    <div key={item.id} className="bg-slate-900 border border-blue-600/50 rounded-lg p-5 shadow-lg relative">
                                        <h4 className="font-semibold text-slate-200 mb-4">{item.scheme_name}</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            <div>
                                                <label className="text-xs font-medium text-slate-400 block mb-1">Group</label>
                                                <select
                                                    value={formData.group_id}
                                                    onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                                                    className="w-full bg-slate-950 border border-slate-700 rounded text-sm px-2 py-1 text-slate-50"
                                                >
                                                    <option value="">Uncategorized</option>
                                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-400 block mb-1">Track Start Date</label>
                                                <input
                                                    type="date"
                                                    value={formData.added_on}
                                                    onChange={(e) => setFormData({ ...formData, added_on: e.target.value })}
                                                    className="w-full bg-slate-950 border border-slate-700 rounded text-sm px-2 py-1 text-slate-50"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-400 block mb-1">Target NAV</label>
                                                <input type="number" step="0.01" value={formData.target_nav} onChange={(e) => setFormData({ ...formData, target_nav: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded text-sm px-2 py-1 text-slate-50" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-400 block mb-1">Units</label>
                                                <input type="number" step="0.001" value={formData.units} onChange={(e) => setFormData({ ...formData, units: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded text-sm px-2 py-1 text-slate-50" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-400 block mb-1">Invested</label>
                                                <input type="number" step="1" value={formData.invested_amount} onChange={(e) => setFormData({ ...formData, invested_amount: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded text-sm px-2 py-1 text-slate-50" />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 mt-4">
                                            <button onClick={() => setEditingItem(null)} className="px-3 py-1 text-sm text-slate-400 hover:text-white border border-slate-700 rounded">Cancel</button>
                                            <button onClick={() => handleUpdateItem(item.scheme_code)} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"><Save className="h-3 w-3 mr-1" /> Save</button>
                                        </div>
                                    </div>
                                );
                            }

                            // View Mode Card Calculation
                            const targetValue = item.units * (item.target_nav || 0);
                            const targetReturn = targetValue - item.invested_amount;
                            const targetReturnPct = item.invested_amount > 0 ? (targetReturn / item.invested_amount * 100) : 0;
                            const averageNAV = item.units > 0 ? item.invested_amount / item.units : 0;

                            // Signal Logic
                            const returnPct = averageNAV > 0 ? (item.nav - averageNAV) / averageNAV : 0;

                            // Target Hit Logic (Past)
                            const isPastTargetHit = item.target_nav > 0 && (item.high_52w >= item.target_nav || item.high_since_tracking >= item.target_nav);

                            // DIP BUY: < -10% (Significant Drop)
                            const showDipBuy = averageNAV > 0 && returnPct < -0.10;

                            // ACCUMULATE: -10% to +10% (Fair Value Range)
                            const showAccumulate = averageNAV > 0 && returnPct >= -0.10 && returnPct <= 0.10;

                            // SELL Logic
                            const valueDiff = targetValue - item.current_value;
                            const isTargetHit = item.target_nav && item.nav >= item.target_nav;

                            // TARGET SELL: NAV Hit OR Value meets/exceeds Target
                            const showTargetSell = !item.is_sold && (isTargetHit || valueDiff <= 0) && item.target_nav > 0 && item.invested_amount > 0;

                            // EARLY SELL: Value is very close (within 50) but not hit yet
                            const showEarlySell = !item.is_sold && !showTargetSell && valueDiff > 0 && valueDiff <= 50 && item.target_nav > 0 && item.invested_amount > 0;

                            // Filter "All Funds": Hide SOLD items, and hide non-signal Active items
                            if (activeGroupId === 'all') {
                                if (item.is_sold) return null; // Hide Sold Items
                                if (!showDipBuy && !showAccumulate && !showTargetSell && !showEarlySell) return null; // Hide non-actionable Active Items
                            }

                            return (
                                <div key={item.id} className={`rounded-lg border shadow-sm p-4 transition-all relative group/card ${item.is_sold ? 'bg-slate-950 border-slate-800' : 'bg-slate-900/50 hover:bg-slate-900 border-slate-800 text-slate-50'}`}>

                                    {/* Sold Overlay / Badge */}
                                    {item.is_sold && (
                                        <div className="absolute bottom-0 left-0 p-2 z-20">
                                            <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-1 rounded border border-slate-700 flex items-center gap-1">
                                                <BadgeDollarSign className="h-3 w-3" /> SOLD @ ₹{item.sold_nav}
                                            </span>
                                        </div>
                                    )}

                                    {/* --- Status Badges (Top Left) --- */}
                                    {!item.is_sold && (
                                        <div className="absolute bottom-0 left-0">
                                            {showDipBuy && (
                                                <div title="Price dropped significantly (< -10%). Good time to buy dips." className="bg-blue-600 text-white text-[10px] uppercase font-bold px-3 py-0.5 rounded-br-lg shadow-sm z-10 flex items-center gap-1 cursor-help">
                                                    <ArrowDownRight className="h-3 w-3" /> DIP BUY ({(returnPct * 100).toFixed(1)}%)
                                                </div>
                                            )}
                                            {showAccumulate && (
                                                <div title="Consistent returns (-10% to +10%). Good for SIP accumulation." className="bg-emerald-600 text-white text-[10px] uppercase font-bold px-3 py-0.5 rounded-br-lg shadow-sm z-10 flex items-center gap-1 cursor-help">
                                                    <TrendingUp className="h-3 w-3" /> ACCUMULATE ({(returnPct * 100).toFixed(1)}%)
                                                </div>
                                            )}
                                            {showTargetSell && (
                                                <div title="Target NAV Hit! Consider selling to book profits." className="bg-red-600 text-white text-[10px] uppercase font-bold px-3 py-0.5 rounded-br-lg shadow-sm z-10 flex items-center gap-1 cursor-help">
                                                    <Target className="h-3 w-3" /> TARGET SELL
                                                </div>
                                            )}
                                            {showEarlySell && (
                                                <div title="Very close to target (within ₹50). Monitor closely." className="bg-amber-600 text-white text-[10px] uppercase font-bold px-3 py-0.5 rounded-br-lg shadow-sm z-10 flex items-center gap-1 cursor-help">
                                                    <AlertCircle className="h-3 w-3" /> EARLY SELL
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Action Buttons (Edit, Sell, Delete) */}
                                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity z-20">
                                        {!item.is_sold && (
                                            <>
                                                <button
                                                    onClick={() => openSellModal(item)}
                                                    className="p-1.5 text-slate-500 hover:text-green-400 bg-slate-950/50 hover:bg-slate-900 rounded"
                                                    title="Mark as Sold"
                                                >
                                                    <BadgeDollarSign className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => startEditingItem(item)}
                                                    className="p-1.5 text-slate-500 hover:text-blue-400 bg-slate-950/50 hover:bg-slate-900 rounded"
                                                    title="Edit Details"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
                                            className="p-1.5 text-slate-500 hover:text-red-400 bg-slate-950/50 hover:bg-slate-900 rounded"
                                            title="Delete Permanently"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 mb-4 w-11/12 flex-wrap">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-wide">{item.group_name}</span>
                                        {item.category && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-blue-400 uppercase tracking-wide truncate max-w-[200px]" title={item.category}>
                                                {item.category.includes('(') ? item.category.split('(')[1].split(')')[0] : item.category}
                                            </span>
                                        )}
                                        <h4 className={`font-semibold text-base line-clamp-1 ${isPastTargetHit ? 'text-emerald-400' : 'text-slate-200'}`} title={item.scheme_name}>{item.scheme_name}</h4>
                                    </div>

                                    {/* New Columnar Layout */}
                                    <div className="grid grid-cols-4 gap-6 text-sm border-t border-slate-800/50 pt-3">

                                        {/* Col 1: NAV Details */}
                                        <div className="space-y-1.5">
                                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">NAV Profile</div>

                                            <div className="flex justify-between items-center text-slate-500">
                                                <span>Target</span>
                                                <span className="font-mono text-slate-400">₹{item.target_nav || '-'}</span>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Current</span>
                                                <div className="text-right">
                                                    <span className="font-mono font-medium text-slate-200">₹{item.nav}</span>
                                                    {item.target_nav > 0 && (
                                                        <div className="text-[10px] leading-none">
                                                            {isTargetHit ? (
                                                                <span className="text-green-500 font-bold">HIT!</span>
                                                            ) : (
                                                                <span className="text-amber-500">{(item.target_nav - item.nav).toFixed(2)} away</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {averageNAV > 0 && (
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center text-slate-500">
                                                        <span>Avg Cost</span>
                                                        <span className="font-mono text-slate-400">₹{averageNAV.toFixed(2)}</span>
                                                    </div>

                                                    {/* Entry Quality Metrics */}
                                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] bg-slate-950/30 p-1.5 rounded border border-slate-800/50 relative">
                                                        <div className="col-span-2 text-slate-600 font-semibold uppercase tracking-wider mb-0.5 flex items-center justify-between">
                                                            <div className="flex items-center gap-1 group/tooltip relative">
                                                                Entry Quality
                                                                <HelpCircle className="h-3 w-3 cursor-help text-slate-700 hover:text-slate-500" />

                                                                {/* Generic Tooltip - Fixed Position/Z-Index */}
                                                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-900 border border-slate-700 rounded-md shadow-xl p-2 z-[60] invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all text-[10px] normal-case tracking-normal text-slate-300 pointer-events-none">
                                                                    <div className="font-bold text-slate-200 mb-1 border-b border-slate-800 pb-1">Metric Guide</div>
                                                                    <div className="space-y-1">
                                                                        <p><span className="text-slate-400">vs H:</span> Diff from High.</p>
                                                                        <p><span className="text-slate-400">vs L:</span> Diff from Low.</p>
                                                                        <div className="pt-1 mt-1 border-t border-slate-800">
                                                                            <p><span className="text-emerald-400 font-bold">Green:</span> Good Entry (Bought Dip/Low)</p>
                                                                            <p><span className="text-amber-500 font-bold">Amber:</span> Risky (Bought at Top)</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Smart Analysis (Specific) - Info Icon Right Aligned */}
                                                            <div className="group/analysis relative flex items-center">
                                                                <Info className="h-3 w-3 cursor-help text-indigo-700 hover:text-indigo-400" />
                                                                <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-950 border border-indigo-500/30 rounded-md shadow-2xl p-2 z-[60] invisible group-hover/analysis:visible opacity-0 group-hover/analysis:opacity-100 transition-all text-[10px] normal-case tracking-normal text-slate-200 pointer-events-none">
                                                                    <div className="font-bold text-indigo-200 mb-1 border-b border-indigo-900/50 pb-1 flex justify-between">
                                                                        <span>AI Analysis</span>
                                                                        <span className="text-[9px] opacity-70">Based on Avg Cost</span>
                                                                    </div>
                                                                    <div className="space-y-1.5 mt-1">
                                                                        {/* High Side Analysis */}
                                                                        {item.high_52w > 0 && (
                                                                            <div className="flex gap-2">
                                                                                <span className="text-slate-400 w-16 shrink-0">vs 52W High:</span>
                                                                                <span>
                                                                                    {(() => {
                                                                                        const diff = (averageNAV - item.high_52w) / item.high_52w;
                                                                                        if (diff < -0.15) return <span className="text-emerald-300 font-semibold">💎 Value Buy! Bought deeply below peak.</span>;
                                                                                        if (diff < -0.05) return <span className="text-emerald-100">Good entry below highs.</span>;
                                                                                        if (diff > -0.02) return <span className="text-amber-300 font-bold">⚠️ FOMO Alert. Bought at very top.</span>;
                                                                                        return <span className="text-slate-300">Neutral entry.</span>;
                                                                                    })()}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Low Side Analysis */}
                                                                        {item.low_52w > 0 && (
                                                                            <div className="flex gap-2">
                                                                                <span className="text-slate-400 w-16 shrink-0">vs 52W Low:</span>
                                                                                <span>
                                                                                    {(() => {
                                                                                        const diff = (averageNAV - item.low_52w) / item.low_52w;
                                                                                        if (diff < 0.05) return <span className="text-emerald-300 font-semibold">🎯 Sniper Entry! Caught the bottom.</span>;
                                                                                        if (diff < 0.20) return <span className="text-emerald-100">Healthy entry near lows.</span>;
                                                                                        if (diff > 0.50) return <span className="text-amber-300">Late entry (far from low).</span>;
                                                                                        return <span className="text-slate-300">Standard entry.</span>;
                                                                                    })()}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Separation Line */}
                                                                        {(item.high_since_tracking > 0 || item.low_since_tracking > 0) && (
                                                                            <div className="border-t border-indigo-900/30 my-1 pt-1"></div>
                                                                        )}

                                                                        {/* Since Tracking High Analysis */}
                                                                        {item.high_since_tracking > 0 && (
                                                                            <div className="flex gap-2">
                                                                                <span className="text-slate-400 w-16 shrink-0">vs Track H:</span>
                                                                                <span>
                                                                                    {(() => {
                                                                                        const diff = (averageNAV - item.high_since_tracking) / item.high_since_tracking;
                                                                                        if (diff < -0.15) return <span className="text-emerald-300 font-semibold">💎 Value Buy! Bought deeply below peak.</span>;
                                                                                        if (diff < -0.05) return <span className="text-emerald-100">Good entry below highs.</span>;
                                                                                        if (diff > -0.02) return <span className="text-amber-300 font-bold">⚠️ FOMO Alert. Bought at very top.</span>;
                                                                                        return <span className="text-slate-300">Neutral entry.</span>;
                                                                                    })()}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Since Tracking Low Analysis */}
                                                                        {item.low_since_tracking > 0 && (
                                                                            <div className="flex gap-2">
                                                                                <span className="text-slate-400 w-16 shrink-0">vs Track L:</span>
                                                                                <span>
                                                                                    {(() => {
                                                                                        const diff = (averageNAV - item.low_since_tracking) / item.low_since_tracking;
                                                                                        if (diff < 0.05) return <span className="text-emerald-300 font-semibold">🎯 Sniper Entry! Caught the bottom.</span>;
                                                                                        if (diff < 0.20) return <span className="text-emerald-100">Healthy entry near lows.</span>;
                                                                                        if (diff > 0.50) return <span className="text-amber-300">Late entry (far from low).</span>;
                                                                                        return <span className="text-slate-300">Standard entry.</span>;
                                                                                    })()}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                        </div>

                                                        {/* vs 52W */}
                                                        <div className="flex justify-between text-slate-500">
                                                            <span>vs 52H</span>
                                                            <span className={`font-mono ${item.high_52w > 0 ? ((averageNAV - item.high_52w) / item.high_52w) < -0.1 ? 'text-emerald-500' : 'text-amber-500' : ''}`}>
                                                                {item.high_52w > 0 ? `${((averageNAV - item.high_52w) / item.high_52w * 100).toFixed(1)}%` : '-'}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-slate-500">
                                                            <span>vs 52L</span>
                                                            <span className={`font-mono ${item.low_52w > 0 ? ((averageNAV - item.low_52w) / item.low_52w) < 0.2 ? 'text-emerald-500' : 'text-slate-400' : ''}`}>
                                                                {item.low_52w > 0 ? (() => {
                                                                    const val = (averageNAV - item.low_52w) / item.low_52w * 100;
                                                                    return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
                                                                })() : '-'}
                                                            </span>
                                                        </div>

                                                        {/* vs Track */}
                                                        <div className="flex justify-between text-slate-500">
                                                            <span>vs H</span>
                                                            <span className={`font-mono ${item.high_since_tracking > 0 ? ((averageNAV - item.high_since_tracking) / item.high_since_tracking) < -0.1 ? 'text-emerald-500' : 'text-amber-500' : ''}`}>
                                                                {item.high_since_tracking > 0 ? `${((averageNAV - item.high_since_tracking) / item.high_since_tracking * 100).toFixed(1)}%` : '-'}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-slate-500">
                                                            <span>vs L</span>
                                                            <span className={`font-mono ${item.low_since_tracking > 0 ? ((averageNAV - item.low_since_tracking) / item.low_since_tracking) < 0.2 ? 'text-emerald-500' : 'text-slate-400' : ''}`}>
                                                                {item.low_since_tracking > 0 ? (() => {
                                                                    const val = (averageNAV - item.low_since_tracking) / item.low_since_tracking * 100;
                                                                    return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
                                                                })() : '-'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Col 2: Investment */}
                                        <div className="space-y-1.5 border-l border-slate-800/50 pl-6">
                                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Your Position</div>

                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Invested</span>
                                                <span className="font-mono text-slate-300">₹{item.invested_amount.toLocaleString()}</span>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">{item.is_sold ? "Realised Val" : "Current"}</span>
                                                <span className="font-mono text-slate-300">₹{item.current_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">{item.is_sold ? "Realised P&L" : "Returns"}</span>
                                                <span className={`font-mono font-medium ${item.gain_loss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {item.gain_loss >= 0 ? '+' : ''}{item.gain_loss.toFixed(0)}
                                                </span>
                                            </div>

                                            <div className="flex justify-end">
                                                <span className={`text-[10px] px-1.5 rounded ${item.gain_loss >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                                    {item.gain_loss_pct.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Col 3: Target Potential */}
                                        <div className="space-y-1.5 border-l border-slate-800/50 pl-6">
                                            {item.is_sold ? (
                                                <>
                                                    {/* REALISED PERFORMANCE - Styled like Entry Quality */}
                                                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Realised Performance</div>

                                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] bg-slate-950/30 p-1.5 rounded border border-slate-800/50 relative">
                                                        <div className="col-span-2 text-slate-600 font-semibold uppercase tracking-wider mb-0.5">
                                                            Exit Summary
                                                        </div>

                                                        <div className="flex justify-between text-slate-500">
                                                            <span>Sold Price</span>
                                                            <span className="font-mono text-slate-300">₹{item.sold_nav}</span>
                                                        </div>

                                                        <div className="flex justify-between text-slate-500">
                                                            <span>Date</span>
                                                            <span className="font-mono text-slate-400">
                                                                {item.sold_date ? new Date(item.sold_date).toLocaleDateString('en-GB') : '-'}
                                                            </span>
                                                        </div>

                                                        <div className="col-span-2 border-t border-slate-800/50 my-1 pt-1">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-500">Net Profit</span>
                                                                <span className={`font-mono font-bold ${item.gain_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                    {item.gain_loss >= 0 ? '+' : ''}{item.gain_loss.toFixed(0)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Target Goal</div>

                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500">Value</span>
                                                        <span className="font-mono text-slate-300">₹{targetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                    </div>

                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500">Profit</span>
                                                        <span className={`font-mono font-medium ${targetReturn >= 0 ? 'text-green-500/80' : 'text-red-500/80'}`}>
                                                            {targetReturn > 0 ? '+' : ''}{targetReturn.toFixed(0)}
                                                        </span>
                                                    </div>

                                                    {item.invested_amount > 0 && item.target_nav > 0 && (
                                                        <div className="flex justify-end mt-1">
                                                            <span className={`text-[10px] px-1.5 rounded ${targetReturn >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                                                {targetReturnPct.toFixed(2)}%
                                                            </span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Col 4: Investment */}
                                        <div className="space-y-1.5 border-l border-slate-800/50 pl-6">
                                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tracking Since</div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Date</span>
                                                <span className="font-mono text-slate-300">{item.added_on}</span>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-slate-800/50 space-y-1">
                                                <div className="flex justify-between items-center text-xs text-slate-500">
                                                    <span>52W High/Low</span>
                                                    <div className="text-right">
                                                        <div className={`font-mono ${item.target_nav > 0 && item.high_52w >= item.target_nav ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                                                            ₹{item.high_52w.toFixed(2)}
                                                            <span className="text-[10px] text-slate-600 ml-1">
                                                                ({item.high_52w_date ? new Date(item.high_52w_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'})
                                                            </span>
                                                        </div>
                                                        <div className="font-mono text-slate-400">
                                                            ₹{item.low_52w.toFixed(2)}
                                                            <span className="text-[10px] text-slate-600 ml-1">
                                                                ({item.low_52w_date ? new Date(item.low_52w_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'})
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-2 pt-2 border-t border-slate-800/50 space-y-1"></div>
                                                <div className="flex justify-between items-center text-xs text-slate-500">
                                                    <span>Since Track H/L</span>
                                                    <div className="text-right">
                                                        <div className={`font-mono ${item.target_nav > 0 && item.high_since_tracking >= item.target_nav ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                                                            ₹{item.high_since_tracking.toFixed(2)}
                                                            <span className="text-[10px] text-slate-600 ml-1">
                                                                ({item.high_since_tracking_date ? new Date(item.high_since_tracking_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'})
                                                            </span>
                                                        </div>
                                                        <div className="font-mono text-slate-400">
                                                            ₹{item.low_since_tracking.toFixed(2)}
                                                            <span className="text-[10px] text-slate-600 ml-1">
                                                                ({item.low_since_tracking_date ? new Date(item.low_since_tracking_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'})
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-600 mt-4 flex justify-end">
                                        Last Updated: {item.date}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* --- Pagination Controls --- */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-8 pb-8">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className={`p-2 rounded-lg border flex items-center gap-2 ${currentPage === 1 ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`}
                        >
                            <ArrowUpRight className="h-4 w-4 rotate-180" /> {/* Left Arrow Hack or use ChevronLeft if available */}
                            Previous
                        </button>

                        <span className="text-slate-400 text-sm font-mono">
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className={`p-2 rounded-lg border flex items-center gap-2 ${currentPage === totalPages ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`}
                        >
                            Next
                            <ArrowUpRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div >
        </div >
    );
};

export default Watchlist;
