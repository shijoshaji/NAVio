import { useState, useEffect, useMemo } from 'react';
import { Plus, Calendar, Trash2, Pencil, Users, ChevronDown, IndianRupee, LayoutDashboard, History } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getInvestments, addInvestment, deleteInvestment, updateInvestment, getAccounts, getSipMandates, createSipMandate, updateSipMandate } from '../services/api';
import FundSelector from '../components/FundSelector';
import ConfirmModal from '../components/ConfirmModal';
import PrivacyGuard from '../components/PrivacyGuard';

const SipTracker = () => {
    const [investments, setInvestments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedScheme, setSelectedScheme] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [formData, setFormData] = useState({
        amount: '',
        purchase_nav: '',
        purchase_date: new Date().toISOString().split('T')[0],
        account_name: 'Default'
    });

    // Edit/Delete State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // Smart SIP State
    const [sipMandates, setSipMandates] = useState([]);
    const [mandateModalOpen, setMandateModalOpen] = useState(false);
    const [activeMandate, setActiveMandate] = useState(null); // For editing/reconciling
    const [reconcileForm, setReconcileForm] = useState({
        // Strategy
        scheme_code: '',
        sip_amount: '',
        start_date: '',
        duration_years: '',
        account_name: 'Default',
        status: 'ACTIVE',
        // Reconciliation
        current_invested: '',
        current_units: '',
        latest_date: new Date().toISOString().split('T')[0]
    });
    const [selectedMandateScheme, setSelectedMandateScheme] = useState(null);

    // View State
    const [currentView, setCurrentView] = useState('strategies'); // 'strategies' | 'history'

    const fetchInvestments = async () => {
        try {
            const { data } = await getInvestments('SIP', true);
            setInvestments(data);
        } catch (error) {
            console.error("Failed to fetch SIPs", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMandates = async () => {
        try {
            const { data } = await getSipMandates(true);
            setSipMandates(data);
        } catch (error) {
            console.error("Failed to fetch mandates", error);
        }
    };

    useEffect(() => {
        fetchInvestments();
        fetchMandates();
        getAccounts().then(({ data }) => setAccounts(data)).catch(err => console.error("Failed to fetch accounts", err));
    }, []);


    const handleSchemeSelect = (scheme) => {
        setSelectedScheme(scheme);

        // Smart Pre-fill: Find last investment for this scheme
        const lastInv = investments.find(i => i.scheme_code === scheme.scheme_code);

        setFormData({
            ...formData,
            purchase_nav: scheme.net_asset_value.toString(),
            // Auto-fill amount and account from last history if available
            amount: lastInv ? lastInv.amount : '',
            account_name: lastInv ? (lastInv.account_name || 'Default') : 'Default'
        });

        if (lastInv) {
            toast.success(`Auto-filled details from last SIP`, { duration: 2000, icon: '⚡' });
        }
    };

    // Monthly Commitment Calculation
    const monthlyCommitment = useMemo(() => {
        const uniqueSIPs = {};
        investments.forEach(inv => {
            // Key by scheme + account to be precise on commitments
            const key = `${inv.scheme_code}-${inv.account_name || 'Default'}`;
            // If we haven't seen this SIP yet, or this entry is NEWER than what we have
            if (!uniqueSIPs[key] || new Date(inv.purchase_date) > new Date(uniqueSIPs[key].date)) {
                uniqueSIPs[key] = { amount: inv.amount, date: inv.purchase_date };
            }
        });

        return Object.values(uniqueSIPs).reduce((sum, item) => sum + item.amount, 0);
    }, [investments]);



    // --- Smart SIP Logic ---

    const getMandateStats = (mandate) => {
        const relevantInvs = investments.filter(i =>
            i.scheme_code === mandate.scheme_code &&
            (i.account_name || 'Default') === (mandate.account_name || 'Default')
        );
        const totalInvested = relevantInvs.reduce((sum, i) => sum + i.amount, 0);
        const totalUnits = relevantInvs.reduce((sum, i) => sum + i.units, 0);

        // Calculate Target
        const totalMonths = mandate.duration_years * 12;
        const targetAmount = totalMonths * mandate.sip_amount;

        // Time Progress
        const start = new Date(mandate.start_date);
        const now = new Date();
        const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

        return { totalInvested, totalUnits, targetAmount, monthsElapsed, totalMonths };
    };

    const openReconcileModal = (mandate = null) => {
        setActiveMandate(mandate);
        if (mandate) {
            const stats = getMandateStats(mandate);
            setReconcileForm({
                scheme_code: mandate.scheme_code,
                sip_amount: mandate.sip_amount,
                start_date: mandate.start_date,
                duration_years: mandate.duration_years,
                account_name: mandate.account_name || 'Default',
                status: mandate.status,
                current_invested: stats.totalInvested,
                current_units: stats.totalUnits,
                latest_date: new Date().toISOString().split('T')[0]
            });
            setSelectedMandateScheme({
                scheme_code: mandate.scheme_code,
                scheme_name: mandate.scheme?.scheme_name,
                net_asset_value: 0 // Will be fetched or ignored
            });
        } else {
            // New Goal
            setReconcileForm({
                scheme_code: '', sip_amount: '', start_date: '', duration_years: '', account_name: 'Default', status: 'ACTIVE',
                current_invested: '', current_units: '', latest_date: new Date().toISOString().split('T')[0]
            });
            setSelectedMandateScheme(null);
        }
        setMandateModalOpen(true);
    };

    const handleReconcileSubmit = async (e) => {
        e.preventDefault();
        try {
            // 1. Save/Update Mandate
            const mandatePayload = {
                scheme_code: selectedMandateScheme.scheme_code,
                account_name: reconcileForm.account_name,
                sip_amount: parseFloat(reconcileForm.sip_amount),
                start_date: reconcileForm.start_date,
                duration_years: parseFloat(reconcileForm.duration_years),
                status: reconcileForm.status
            };

            let savedMandate;
            if (activeMandate) {
                const { data } = await updateSipMandate(activeMandate.id, mandatePayload);
                savedMandate = data;
                toast.success("Strategy Updated");
            } else {
                const { data } = await createSipMandate(mandatePayload);
                savedMandate = data;
                toast.success("New SIP Goal Created");
            }

            // 2. Reconcile Investments (Create Delta)
            if (activeMandate) {
                const stats = getMandateStats(activeMandate);

                const inputInvested = parseFloat(reconcileForm.current_invested) || 0;
                const currentInvested = stats.totalInvested;
                const deltaAmount = inputInvested - currentInvested;

                const inputUnits = parseFloat(reconcileForm.current_units) || 0;
                const currentUnits = stats.totalUnits;
                const deltaUnits = inputUnits - currentUnits;

                if (deltaAmount > 1) {
                    let navToUse = selectedMandateScheme.net_asset_value || 10;

                    // If user provided units update, calculate implied NAV
                    if (deltaUnits > 0.001) {
                        navToUse = deltaAmount / deltaUnits;
                    }

                    await addInvestment({
                        scheme_code: mandatePayload.scheme_code,
                        type: 'SIP',
                        amount: deltaAmount,
                        purchase_nav: navToUse,
                        purchase_date: reconcileForm.latest_date,
                        account_name: mandatePayload.account_name
                    });
                    toast.success(`Recorded ₹${deltaAmount.toLocaleString()} investment`);
                }
            }

            setMandateModalOpen(false);
            fetchMandates();
            fetchInvestments();
        } catch (error) {
            console.error(error);
            toast.error("Failed to update");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedScheme) {
            toast.error("Please select a fund");
            return;
        }

        try {
            const payload = {
                scheme_code: selectedScheme.scheme_code,
                type: 'SIP',
                ...formData
            };

            if (isEditMode) {
                await updateInvestment(editingId, payload);
                toast.success("SIP Investment updated successfully");
                setIsEditMode(false);
                setEditingId(null);
            } else {
                await addInvestment(payload);
                toast.success("SIP Investment added successfully");
            }

            // Reset Form
            setFormData({
                amount: '',
                purchase_nav: '',
                purchase_date: new Date().toISOString().split('T')[0],
                account_name: 'Default'
            });
            setSelectedScheme(null);
            fetchInvestments();
            // Refresh accounts list in case a new one was added
            getAccounts().then(({ data }) => setAccounts(data));

        } catch (error) {
            console.error("Failed to save SIP", error);
            toast.error(isEditMode ? "Failed to update SIP" : "Failed to add SIP");
        }
    };

    const handleEdit = (inv) => {
        setIsEditMode(true);
        setEditingId(inv.id);

        // Populate Form
        setFormData({
            amount: inv.amount,
            purchase_nav: inv.purchase_nav,
            purchase_date: inv.purchase_date,
            account_name: inv.account_name || 'Default'
        });

        // For scheme selector, we need to reconstruct the scheme object slightly
        // or just rely on what we have. The FundSelector might expect a full object.
        // inv.scheme is available? Backend returns Investment object which has 'scheme' relation.
        // Let's check backend output. 'get_investments' returns list of Investment objects.
        // Investment object has 'scheme' relationship. Pydantic model might need to include it if we want it here.
        // Actually, in main.py get_investments returns list of models.Investment.
        // Fastapi will serialize it. The default serialization might not include relation unless eager loaded or in Pydantic schema?
        // Wait, main.py doesn't use Pydantic response_model for get_investments. It returns ORM objects directly.
        // SQLAlchemy Lazy loading might fail if session is closed, but here it's within request scope?
        // Fastapi usually needs Pydantic model to serialize relations properly or return dicts.
        // If relation is lazy, it might be missing.
        // However, let's assume 'inv.scheme_code' is there.
        // FundSelector usually takes a scheme object.

        // We will pass a mock scheme object with scheme_code and net_asset_value to pre-fill selector
        // But FundSelector might need 'scheme_name'.
        // We need to fetch details or rely on what's available.
        // Let's rely on standard fields.

        // Note: If scheme details are missing in `inv`, we can't fully populate FundSelector (name etc).
        // Let's assume we can at least set scheme_code.
        // Ideally we should have scheme name in the list item.
        // See 'Recent History' code below: {inv.scheme_code} is used.

        setSelectedScheme({
            scheme_code: inv.scheme_code,
            scheme_name: inv.scheme?.scheme_name || inv.scheme_code, // Fallback
            net_asset_value: inv.purchase_nav // Just for display if needed
        });
    };

    const initiateDelete = (inv) => {
        setItemToDelete(inv);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteInvestment(itemToDelete.id);
            toast.success("Investment deleted");
            fetchInvestments();
        } catch (error) {
            console.error("Failed to delete", error);
            toast.error("Failed to delete investment");
        }
    };

    const cancelEdit = () => {
        setIsEditMode(false);
        setEditingId(null);
        setFormData({
            amount: '',
            purchase_nav: '',
            purchase_date: new Date().toISOString().split('T')[0],
            account_name: 'Default'
        });
        setSelectedScheme(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">SIP Tracker</h2>
                    <p className="text-slate-400 text-sm mt-1">Manage your systematic investment plans</p>
                </div>

                {/* Monthly Commitment Card */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-5 py-3 flex items-center gap-4">
                    <div className="p-2 bg-blue-500/10 rounded-full">
                        <IndianRupee className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs text-blue-300 font-medium uppercase tracking-wider">Monthly Commitment</p>
                        <p className="text-xl font-bold text-white tracking-tight">
                            <PrivacyGuard>₹{monthlyCommitment.toLocaleString()}</PrivacyGuard>
                        </p>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800 w-fit">
                <button
                    onClick={() => setCurrentView('strategies')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${currentView === 'strategies' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <LayoutDashboard className="h-4 w-4" /> Overview & Strategies
                </button>
                <button
                    onClick={() => setCurrentView('history')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${currentView === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <History className="h-4 w-4" /> Transaction History
                </button>
            </div>

            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Investment"
                message="Are you sure you want to delete this SIP investment? This will recalculate your portfolio average NAV."
                confirmText="Delete"
                isDanger={true}
            />

            {/* Mandate/Reconcile Modal */}
            {
                mandateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-6">{activeMandate ? 'Update SIP Status' : 'New SIP Strategy'}</h3>

                            <form onSubmit={handleReconcileSubmit} className="space-y-6">
                                {/* Section 1: Strategy */}
                                <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                                    <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Calendar className="h-4 w-4" /> Strategy Details
                                    </h4>
                                    <div className="space-y-4">
                                        <FundSelector
                                            onSelect={(s) => { setSelectedMandateScheme(s); setReconcileForm({ ...reconcileForm, scheme_code: s.scheme_code }) }}
                                            selectedScheme={selectedMandateScheme}
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1 block">Monthly SIP Amount</label>
                                                <input type="number" required className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" value={reconcileForm.sip_amount} onChange={e => setReconcileForm({ ...reconcileForm, sip_amount: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1 block">Account</label>
                                                <select className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" value={reconcileForm.account_name} onChange={e => setReconcileForm({ ...reconcileForm, account_name: e.target.value })}>
                                                    <option value="Default">Default</option>
                                                    {accounts.map(acc => {
                                                        const val = typeof acc === 'object' ? acc.name : acc;
                                                        if (val === 'Default') return null;
                                                        return <option key={val} value={val}>{val}</option>;
                                                    })}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1 block">Start Date</label>
                                                <input type="date" required className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" value={reconcileForm.start_date} onChange={e => setReconcileForm({ ...reconcileForm, start_date: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1 block">Plan Duration (Years)</label>
                                                <input type="number" step="0.5" required className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" value={reconcileForm.duration_years} onChange={e => setReconcileForm({ ...reconcileForm, duration_years: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Reconciliation (Only if editing) */}
                                {activeMandate && (
                                    <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                                        <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <IndianRupee className="h-4 w-4" /> Update Status (Reconcile)
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2 grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-slate-500 mb-1 block">Total Invested Amount</label>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-lg font-bold text-white"
                                                        value={reconcileForm.current_invested}
                                                        onChange={e => setReconcileForm({ ...reconcileForm, current_invested: e.target.value })}
                                                    />
                                                    <p className="text-[10px] text-slate-500 mt-1">
                                                        Current: <span className="text-slate-300">₹{getMandateStats(activeMandate).totalInvested.toLocaleString()}</span>
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 mb-1 block">Total Units</label>
                                                    <input
                                                        type="number" step="0.001"
                                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-lg font-bold text-white"
                                                        value={reconcileForm.current_units}
                                                        onChange={e => setReconcileForm({ ...reconcileForm, current_units: e.target.value })}
                                                    />
                                                    <p className="text-[10px] text-slate-500 mt-1">
                                                        Current: <span className="text-slate-300">{getMandateStats(activeMandate).totalUnits.toFixed(3)}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1 block">Transaction Date</label>
                                                <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" value={reconcileForm.latest_date} onChange={e => setReconcileForm({ ...reconcileForm, latest_date: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setMandateModalOpen(false)} className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded hover:bg-slate-700">Cancel</button>
                                    <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded hover:bg-blue-500 font-medium">Save & Update</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Smart SIP Cards Grid (Strategies Tab) */}
            {
                currentView === 'strategies' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">Active SIP Strategies</h3>
                            <button onClick={() => openReconcileModal(null)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium">
                                <Plus className="h-4 w-4" /> New SIP Goal
                            </button>
                        </div>

                        {sipMandates.length === 0 ? (
                            <div className="text-center py-12 bg-slate-900/50 rounded-lg border border-dashed border-slate-800">
                                <p className="text-slate-400">No active SIP goals. Add one to track your progress!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {sipMandates.map(mandate => {
                                    const stats = getMandateStats(mandate);
                                    const pendingAmt = Math.max(0, stats.targetAmount - stats.totalInvested);
                                    const progressPercent = Math.min(100, (stats.totalInvested / stats.targetAmount) * 100);

                                    return (
                                        <div key={mandate.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-600 transition-all shadow-sm group">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-slate-100 line-clamp-1 text-lg mb-1" title={mandate.scheme?.scheme_name}>{mandate.scheme?.scheme_name}</h4>
                                                    <span className="text-[10px] uppercase tracking-wider font-bold bg-slate-800 text-slate-400 px-2 py-1 rounded">{mandate.account_name}</span>
                                                </div>
                                                <button onClick={() => openReconcileModal(mandate)} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors" title="Edit / Reconcile">
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-5">
                                                <div className="bg-slate-950/50 p-2 rounded border border-slate-800/50">
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-0.5">Invested</p>
                                                    <p className="text-lg font-mono text-white font-medium">
                                                        <PrivacyGuard>₹{(stats.totalInvested / 1000).toFixed(1)}k</PrivacyGuard>
                                                    </p>
                                                </div>
                                                <div className="bg-slate-950/50 p-2 rounded border border-slate-800/50">
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-0.5">Target</p>
                                                    <p className="text-lg font-mono text-slate-400">
                                                        <PrivacyGuard>₹{(stats.targetAmount / 100000).toFixed(2)}L</PrivacyGuard>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mb-2 flex justify-between text-xs text-slate-500">
                                                <span>Progress</span>
                                                <span>{progressPercent.toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full bg-slate-800 h-2 rounded-full mb-4 overflow-hidden">
                                                <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full" style={{ width: `${progressPercent}%` }}></div>
                                            </div>

                                            <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800">
                                                <span className="text-slate-400"> Monthly: <span className="text-white font-medium">₹{mandate.sip_amount}</span></span>
                                                <span className="text-slate-400"> Pending: <span className="text-amber-500 font-medium">₹{(pendingAmt / 1000).toFixed(0)}k</span></span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )
            }

            {/* Transaction Ledger (History Tab) */}
            {
                currentView === 'history' && (
                    <div className="grid gap-6 md:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Add/Edit Form */}
                        <div className="bg-slate-900 text-slate-50 rounded-lg border border-slate-800 shadow-sm p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">{isEditMode ? 'Edit Installment' : 'Add New Installment'}</h3>
                                {isEditMode && (
                                    <button onClick={cancelEdit} className="text-xs text-slate-400 hover:text-white">Cancel</button>
                                )}
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <FundSelector
                                    onSelect={handleSchemeSelect}
                                    selectedScheme={selectedScheme}
                                />

                                <div>
                                    <label className="text-sm font-medium">Account</label>
                                    <div className="relative mt-1">
                                        <Users className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 z-10" />
                                        <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-500 pointer-events-none z-10" />
                                        <select
                                            className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 pl-10 pr-10 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none relative"
                                            value={formData.account_name}
                                            onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                                        >
                                            <option value="Default">Default</option>
                                            {accounts.map(acc => {
                                                const val = typeof acc === 'object' ? acc.name : acc;
                                                if (val === 'Default') return null;
                                                return <option key={val} value={val}>{val}</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium">Amount (₹)</label>
                                    <input
                                        type="number"
                                        required
                                        className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium">Purchase NAV</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            required
                                            className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                                            placeholder="0.0000"
                                            value={formData.purchase_nav}
                                            onChange={(e) => setFormData({ ...formData, purchase_nav: e.target.value })}
                                            readOnly={!!selectedScheme && isEditMode === false && false}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Date</label>
                                        <input
                                            type="date"
                                            required
                                            className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                                            value={formData.purchase_date}
                                            onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                                            max={new Date().toISOString().split('T')[0]}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className={`inline-flex items-center justify-center rounded-md text-sm font-medium text-white h-10 px-4 py-2 w-full transition-colors ${isEditMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                >
                                    {isEditMode ? (
                                        <>Update Investment</>
                                    ) : (
                                        <><Plus className="mr-2 h-4 w-4" /> Add Investment</>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Recent Investments List */}
                        <div className="bg-slate-900 text-slate-50 rounded-lg border border-slate-800 shadow-sm p-6 overflow-hidden flex flex-col">
                            <h3 className="text-lg font-semibold mb-4">Recent History</h3>
                            <div className="overflow-y-auto flex-1 max-h-[600px]">
                                {investments.length === 0 ? (
                                    <div className="text-slate-400 text-center py-10">No SIP investments found.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {investments.map((inv) => (
                                            <div key={inv.id} className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${editingId === inv.id ? 'border-amber-500 bg-amber-900/10' : 'border-slate-800 hover:bg-slate-800/50'
                                                }`}>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium leading-none truncate max-w-[200px]" title={inv.scheme?.scheme_name || inv.scheme_code}>
                                                        {inv.scheme?.scheme_name || inv.scheme_code}
                                                    </p>
                                                    <p className="text-xs text-slate-400 flex items-center gap-3">
                                                        <span className="flex items-center"><Calendar className="mr-1 h-3 w-3" /> <PrivacyGuard>{inv.purchase_date}</PrivacyGuard></span>
                                                        <span className="flex items-center text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-800"><Users className="mr-1 h-3 w-3" /> {inv.account_name || 'Default'}</span>
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold"><PrivacyGuard>₹{inv.amount.toLocaleString()}</PrivacyGuard></p>
                                                        <p className="text-xs text-slate-400">
                                                            <PrivacyGuard>{inv.units.toFixed(3)} units</PrivacyGuard> @ <PrivacyGuard>₹{inv.purchase_nav}</PrivacyGuard>
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => handleEdit(inv)}
                                                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => initiateDelete(inv)}
                                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default SipTracker;
