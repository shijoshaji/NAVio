import { useState, useEffect, useMemo } from 'react';
import { Plus, Calendar, Trash2, Pencil, Users, ChevronDown, IndianRupee, LayoutDashboard, History, Check, TrendingUp, ArrowRightLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getInvestments, addInvestment, deleteInvestment, updateInvestment, getAccounts, getSipMandates, createSipMandate, updateSipMandate, deleteSipMandate, convertSipToLumpsum } from '../services/api';
import FundSelector from '../components/FundSelector';
import ConfirmModal from '../components/ConfirmModal';
import PrivacyGuard from '../components/PrivacyGuard';

const SipTracker = () => {
    const [investments, setInvestments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sipMandates, setSipMandates] = useState([]);
    const [selectedScheme, setSelectedScheme] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [convertModal, setConvertModal] = useState({
        isOpen: false,
        mandate: null,
        startDate: new Date().toISOString().split('T')[0],
        duration: '3'
    });
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

    // Account Filter State
    const [filterAccount, setFilterAccount] = useState('All');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;



    // Smart SIP State
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

    // Mandate Delete State
    const [deleteMandateModalOpen, setDeleteMandateModalOpen] = useState(false);

    // Derived Data: Filtered Mandates
    const filteredMandates = useMemo(() => {
        if (!sipMandates) return [];
        return sipMandates.filter(m => {
            if (filterAccount !== 'All' && (m.account_name || 'Default') !== filterAccount) return false;
            return true;
        });
    }, [sipMandates, filterAccount]);

    // Reset Page on Filter Change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterAccount]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredMandates.length / ITEMS_PER_PAGE);
    const paginatedMandates = filteredMandates.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const [mandateToDelete, setMandateToDelete] = useState(null);

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

    const handleConvert = async (mandateId) => {
        const toastId = toast.loading('Converting SIP to Lumpsum...');
        try {
            await convertSipToLumpsum(mandateId, {
                start_date: convertModal.startDate,
                duration_years: parseFloat(convertModal.duration)
            });
            toast.success('Converted successfully!', { id: toastId });
            setConvertModal({ ...convertModal, isOpen: false, mandate: null });
            // Refresh everything
            fetchMandates();
            fetchInvestments();
        } catch (error) {
            console.error('Conversion failed', error);
            toast.error('Conversion failed', { id: toastId });
        }
    };

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
        // Sum of all active SIP Mandate amounts (respecting filter)
        return filteredMandates.reduce((sum, mandate) => {
            return sum + (mandate.status !== 'INACTIVE' ? mandate.sip_amount : 0);
        }, 0);
    }, [filteredMandates]);

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

        // Check if paid this month
        // Sort by date desc
        const sortedInvs = [...relevantInvs].sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));
        const latestInvestment = sortedInvs.length > 0 ? sortedInvs[0] : null;

        let isPaidThisMonth = false;
        if (latestInvestment) {
            const lastDate = new Date(latestInvestment.purchase_date);
            isPaidThisMonth = lastDate.getMonth() === now.getMonth() && lastDate.getFullYear() === now.getFullYear();
        }

        return { totalInvested, totalUnits, targetAmount, monthsElapsed, totalMonths, isPaidThisMonth };
    };

    // Pending Goal Calculation (Total Target - Total Invested)
    // NOTE: Must be defined AFTER getMandateStats
    const pendingGoalAmount = useMemo(() => {
        return filteredMandates.reduce((sum, mandate) => {
            if (mandate.status === 'INACTIVE') return sum;
            const stats = getMandateStats(mandate);
            const pending = Math.max(0, stats.targetAmount - stats.totalInvested);
            return sum + pending;
        }, 0);
    }, [filteredMandates, investments]);

    const handleQuickRecord = async (mandate) => {

        setCurrentView('history');
        // Scroll to form?
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast("Enter today's NAV to confirm!", { icon: '📝' });
    };

    // Flag to distinguish between "Edit Strategy Details" and "Update Status/Reconcile"
    const [isStrategyEditMode, setIsStrategyEditMode] = useState(false);

    const openReconcileModal = (mandate = null) => {
        setActiveMandate(mandate);
        setIsStrategyEditMode(false); // Default to Reconcile/New mode logic

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
                net_asset_value: 0
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

    const openEditStrategy = (mandate) => {
        setActiveMandate(mandate);
        setIsStrategyEditMode(true); // Enable Edit Strategy Mode

        // Pre-fill form variables
        const stats = getMandateStats(mandate);
        setReconcileForm({
            scheme_code: mandate.scheme_code,
            sip_amount: mandate.sip_amount,
            start_date: mandate.start_date,
            duration_years: mandate.duration_years,
            account_name: mandate.account_name || 'Default',
            status: mandate.status,
            // Initialize Reconcile fields to current values so Delta is 0 if saved (preventing accidental transaction)
            current_invested: stats.totalInvested,
            current_units: stats.totalUnits,
            latest_date: new Date().toISOString().split('T')[0]
        });
        setSelectedMandateScheme({
            scheme_code: mandate.scheme_code,
            scheme_name: mandate.scheme?.scheme_name,
            net_asset_value: 0
        });
        setMandateModalOpen(true);
    }

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

            // 2. Reconcile Investments (Create Delta) - SKIP if just editing strategy details
            if (activeMandate && !isStrategyEditMode) {
                const stats = getMandateStats(activeMandate);

                const inputInvested = parseFloat(reconcileForm.current_invested) || 0;
                const currentInvested = stats.totalInvested;
                const deltaAmount = inputInvested - currentInvested;

                const inputUnits = parseFloat(reconcileForm.current_units) || 0;
                const currentUnits = stats.totalUnits;
                const deltaUnits = inputUnits - currentUnits;

                if (Math.abs(deltaAmount) > 1 || Math.abs(deltaUnits) > 0.001) {

                    // NEGATIVE DELTA HANDLING (Correction vs Redemption)
                    if (deltaAmount < 0 && !reconcileForm.isRedemption) {
                        // SMART UNWIND: Delete/Reduce recent investments to match new total
                        // This avoids "Realized P&L" because we are erasing the purchase history
                        let remainingDelta = Math.abs(deltaAmount);
                        let remainingUnitDelta = Math.abs(deltaUnits);

                        // Get investments sorted by newest first
                        const relevantInvs = investments
                            .filter(i => i.scheme_code === mandatePayload.scheme_code && (i.account_name || 'Default') === (mandatePayload.account_name || 'Default'))
                            .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date));

                        for (const inv of relevantInvs) {
                            if (remainingDelta <= 0) break;

                            if (inv.amount <= remainingDelta + 1) { // +1 for floating point tolerance
                                // Delete this entire entry
                                await deleteInvestment(inv.id);
                                remainingDelta -= inv.amount;
                                remainingUnitDelta -= inv.units; // Approximation if units not perfectly tracked
                            } else {
                                // Reduce this entry
                                const newAmount = inv.amount - remainingDelta;
                                // Calculate new units: We try to keep NAV constant or use user's deltaUnits
                                // If we have remainingUnitDelta, we reduce units by that.
                                // But safely, let's keep NAV constant implies: newUnits = newAmount / (inv.purchase_nav)
                                // However, user might have specified exact unit drop. 
                                // Let's try to honor the NAV of the original transaction for the remaining part.
                                const originalNav = inv.purchase_nav || 10;
                                const newUnits = newAmount / originalNav;

                                await updateInvestment(inv.id, {
                                    ...inv, // Keep other fields
                                    amount: newAmount,
                                    units: newUnits // Backend usually calcs units from amount/nav, but if we send payload? 
                                    // Actually updateInvestment(id, schema) -> if we send amount & purchase_nav, it recalcs units.
                                    // We keep purchase_nav constant.
                                });
                                remainingDelta = 0;
                                remainingUnitDelta = 0;
                            }
                        }
                        toast.success("Corrected investment history (No P&L generated)");

                    } else {
                        // POSITIVE DELTA OR EXPLICIT REDEMPTION
                        let navToUse = selectedMandateScheme.net_asset_value || 10;

                        // If user provided units update, calculate implied NAV
                        if (Math.abs(deltaUnits) > 0.001) {
                            // Avoid division by zero
                            navToUse = Math.abs(deltaAmount) < 1 ? (selectedMandateScheme.net_asset_value || 10) : (deltaAmount / deltaUnits);
                        }

                        if (deltaAmount !== 0) {
                            await addInvestment({
                                scheme_code: mandatePayload.scheme_code,
                                type: 'SIP',
                                amount: deltaAmount,
                                purchase_nav: Math.abs(navToUse), // NAV must be positive even for sell
                                purchase_date: reconcileForm.latest_date,
                                account_name: mandatePayload.account_name
                            });
                            const msg = deltaAmount > 0 ? `Recorded investment of ₹${deltaAmount.toLocaleString()}` : `Recorded redemption of ₹${Math.abs(deltaAmount).toLocaleString()}`;
                            toast.success(msg);
                        }
                    }
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

    const initiateMandateDelete = (mandate) => {
        setMandateToDelete(mandate);
        setDeleteMandateModalOpen(true);
    };

    const confirmMandateDelete = async () => {
        if (!mandateToDelete) return;
        try {
            await deleteSipMandate(mandateToDelete.id);
            toast.success("SIP Strategy deleted");
            fetchMandates();
        } catch (error) {
            console.error("Failed to delete strategy", error);
            toast.error("Failed to delete SIP Strategy");
        } finally {
            setDeleteMandateModalOpen(false);
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
        // Pydantic model might need to include it if we want it here.
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-blue-500" />
                        SIP Tracker
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Track and manage your Systematic Investment Plans
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Account Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => document.getElementById('account-dropdown')?.classList.toggle('hidden')}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg border border-slate-700 transition-colors text-sm font-medium"
                        >
                            <Users className="h-4 w-4 text-blue-400" />
                            {filterAccount === 'All' ? 'All Accounts' : filterAccount}
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>
                        {/* Dropdown Menu */}
                        <div id="account-dropdown" className="hidden absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1"
                            onMouseLeave={(e) => e.currentTarget.classList.add('hidden')}>
                            <button
                                onClick={() => { setFilterAccount('All'); document.getElementById('account-dropdown').classList.add('hidden'); }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 ${filterAccount === 'All' ? 'text-blue-400 font-medium' : 'text-slate-300'}`}
                            >
                                All Accounts
                            </button>
                            {accounts.map(acc => {
                                const accName = typeof acc === 'object' ? acc.name : acc;
                                const accId = typeof acc === 'object' ? (acc.id || acc.name) : acc;
                                return (
                                    <button
                                        key={accId}
                                        onClick={() => { setFilterAccount(accName); document.getElementById('account-dropdown').classList.add('hidden'); }}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-800 ${filterAccount === accName ? 'text-blue-400 font-medium' : 'text-slate-300'}`}
                                    >
                                        {accName}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg flex items-center gap-3 shadow-sm">
                        <div className="p-2 bg-blue-500/10 rounded-full">
                            <Calendar className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase font-semibold">SIP Book</p>
                            <p className="text-lg font-bold text-white tracking-tight">
                                <PrivacyGuard>₹{monthlyCommitment.toLocaleString()}</PrivacyGuard>
                            </p>
                        </div>
                    </div>

                    <div className="hidden md:flex bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg items-center gap-3 shadow-sm">
                        <div className="p-2 bg-purple-500/10 rounded-full">
                            <IndianRupee className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase font-semibold">Pending Goal</p>
                            <p className="text-lg font-bold text-white tracking-tight">
                                <PrivacyGuard>₹{pendingGoalAmount.toLocaleString()}</PrivacyGuard>
                            </p>
                        </div>
                    </div>

                    <button onClick={() => openReconcileModal(null)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium shadow-lg hover:shadow-blue-500/20 transition-all">
                        <Plus className="h-4 w-4" /> New SIP
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800 w-fit mb-6">
                <button
                    onClick={() => setCurrentView('strategies')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${currentView === 'strategies' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <LayoutDashboard className="h-4 w-4" /> Active SIPs
                </button>
                <button
                    onClick={() => setCurrentView('history')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${currentView === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                >
                    <History className="h-4 w-4" /> Transaction History
                </button>
            </div>

            {/* Unified SIP Table (Active Tab) */}
            {currentView === 'strategies' && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Fund Name</th>
                                    <th className="px-6 py-4">Plan Details</th>
                                    <th className="px-6 py-4 text-right bg-slate-800/20 border-l border-r border-slate-800/50 text-blue-300">Total Invested <Pencil className="inline h-3 w-3 ml-1 mb-0.5 opacity-50" /></th>
                                    <th className="px-6 py-4 text-right bg-slate-800/20 border-r border-slate-800/50 text-blue-300">Total Units <Pencil className="inline h-3 w-3 ml-1 mb-0.5 opacity-50" /></th>
                                    <th className="px-6 py-4 text-right">Progress</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredMandates.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                            {filterAccount !== 'All' ? `No active SIPs found for ${filterAccount}.` : 'No active SIPs. Click "New SIP" to start tracking.'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedMandates.map(mandate => {
                                        const stats = getMandateStats(mandate);
                                        const progressPercent = Math.min(100, (stats.totalInvested / stats.targetAmount) * 100);

                                        return (
                                            <tr key={mandate.id} className="hover:bg-slate-800/30 transition-colors group">
                                                {/* Fund & Account */}
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-200 text-base mb-1" title={mandate.scheme?.scheme_name}>
                                                        {mandate.scheme?.scheme_name}
                                                    </div>
                                                    <span className="text-[10px] uppercase tracking-wider font-bold bg-slate-800 text-slate-500 px-2 py-0.5 rounded border border-slate-700">
                                                        <PrivacyGuard>{mandate.account_name}</PrivacyGuard>
                                                    </span>
                                                </td>

                                                {/* Plan Details */}
                                                <td className="px-6 py-4 text-slate-400">
                                                    <div className="flex items-center gap-1.5 text-slate-300 mb-1">
                                                        <IndianRupee className="h-3 w-3" />
                                                        <span className="font-semibold">{mandate.sip_amount.toLocaleString()}</span> <span className="text-xs text-slate-500">/ mo</span>
                                                    </div>
                                                    <div className="text-xs mb-1">
                                                        For {mandate.duration_years} Years
                                                    </div>
                                                    {mandate.start_date && (
                                                        <div className="text-[10px] text-slate-500 flex flex-col gap-0.5 mt-2 pt-2 border-t border-slate-800">
                                                            <div className="flex justify-between gap-3">
                                                                <span>Start:</span>
                                                                <span className="text-slate-400">{new Date(mandate.start_date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-3">
                                                                <span>End:</span>
                                                                <span className="text-slate-400">
                                                                    {(() => {
                                                                        const start = new Date(mandate.start_date);
                                                                        const end = new Date(start);
                                                                        end.setFullYear(start.getFullYear() + (mandate.duration_years || 0));
                                                                        return end.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Editable: Total Invested */}
                                                <td className="px-6 py-4 text-right font-mono text-base font-medium text-white cursor-pointer hover:bg-slate-800 transition-colors bg-slate-800/10 border-l border-r border-slate-800/50"
                                                    onClick={() => openReconcileModal(mandate)}
                                                    title="Click to Update Status">
                                                    <div className="flex items-center justify-end gap-2 group-hover/cell:text-blue-400">
                                                        <PrivacyGuard>₹{(stats.totalInvested).toLocaleString()}</PrivacyGuard>
                                                    </div>
                                                    {stats.isPaidThisMonth && <div className="text-[10px] text-emerald-500 font-normal mt-0.5 flex items-center justify-end gap-1"><Check className="h-3 w-3" /> Updated</div>}
                                                </td>

                                                {/* Editable: Total Units */}
                                                <td className="px-6 py-4 text-right font-mono text-base font-medium text-slate-300 cursor-pointer hover:bg-slate-800 transition-colors bg-slate-800/10 border-r border-slate-800/50"
                                                    onClick={() => openReconcileModal(mandate)}
                                                    title="Click to Update Status">
                                                    <PrivacyGuard>{stats.totalUnits.toFixed(3)}</PrivacyGuard>
                                                </td>

                                                {/* Progress Bar */}
                                                <td className="px-6 py-4 w-48">
                                                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                        <span>{progressPercent.toFixed(0)}%</span>
                                                        <span>Target: ₹{(stats.targetAmount / 100000).toFixed(1)}L</span>
                                                    </div>
                                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${progressPercent}%` }}></div>
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openEditStrategy(mandate)} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors" title="Edit Strategy Details">
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => openReconcileModal(mandate)} className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-emerald-900/20 rounded-lg transition-colors" title="Update Status">
                                                            {/* User requested '$' icon (BadgeDollarSign or IndianRupee) */}
                                                            <IndianRupee className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => setConvertModal({
                                                            isOpen: true,
                                                            mandate,
                                                            startDate: new Date().toISOString().split('T')[0],
                                                            duration: '3'
                                                        })} className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-900/20 rounded-lg transition-colors" title="Convert to Lumpsum">
                                                            <ArrowRightLeft className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => initiateMandateDelete(mandate)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors" title="Delete Strategy">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Footer */}
                    {totalPages > 1 && (
                        <div className="bg-slate-950/30 border-t border-slate-800 p-4 flex items-center justify-between">
                            <div className="text-xs text-slate-500">
                                Showing <span className="text-slate-300 font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-slate-300 font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredMandates.length)}</span> of <span className="text-slate-300 font-medium">{filteredMandates.length}</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-xs text-slate-400 self-center px-2">Page {currentPage} of {totalPages}</span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Recent History (Transaction History Tab) */}
            {currentView === 'history' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Reusing existing history list logic */}
                    <div className="bg-slate-900 text-slate-50 rounded-lg border border-slate-800 shadow-sm p-6 overflow-hidden flex flex-col h-[calc(100vh-250px)]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">Transaction Ledger</h3>
                            <p className="text-xs text-slate-500">Read-only view of historical adjustments</p>
                        </div>

                        <div className="overflow-y-auto flex-1 pr-2">
                            {investments.length === 0 ? (
                                <div className="text-slate-400 text-center py-10">No SIP investments found.</div>
                            ) : (
                                <div className="space-y-4">
                                    {investments.map((inv) => (
                                        <div key={inv.id} className="flex items-center justify-between p-4 border border-slate-800 rounded-lg hover:bg-slate-800/50 transition-colors">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium leading-none truncate max-w-[300px]" title={inv.scheme?.scheme_name || inv.scheme_code}>
                                                    {inv.scheme?.scheme_name || inv.scheme_code}
                                                </p>
                                                <p className="text-xs text-slate-400 flex items-center gap-3">
                                                    <span className="flex items-center"><Calendar className="mr-1 h-3 w-3" /> <PrivacyGuard>{inv.purchase_date}</PrivacyGuard></span>
                                                    <span className="flex items-center text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-800"><Users className="mr-1 h-3 w-3" /> <PrivacyGuard>{inv.account_name || 'Default'}</PrivacyGuard></span>
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-emerald-400">+₹{inv.amount.toLocaleString()}</p>
                                                    <p className="text-xs text-slate-400">
                                                        <PrivacyGuard>{inv.units.toFixed(3)} units</PrivacyGuard> @ <PrivacyGuard>₹{inv.purchase_nav}</PrivacyGuard>
                                                    </p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => initiateDelete(inv)}
                                                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                                                        title="Delete Entry"
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
            )}

            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Investment"
                message="Are you sure you want to delete this SIP investment? This will recalculate your portfolio average NAV."
                confirmText="Delete"
                isDanger={true}
            />

            <ConfirmModal
                isOpen={deleteMandateModalOpen}
                onClose={() => setDeleteMandateModalOpen(false)}
                onConfirm={confirmMandateDelete}
                title="Delete SIP Strategy"
                message="Are you sure you want to delete this SIP Strategy? WARNING: This will PERMANENTLY DELETE all historical 'SIP' transactions for this fund and account. This action cannot be undone."
                confirmText="Permanently Delete Strategy"
                isDanger={true}
            />

            {/* Mandate/Reconcile Modal */}
            {
                mandateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-1">
                                {!activeMandate ? 'New SIP Strategy' : (isStrategyEditMode ? 'Edit Strategy Details' : 'Update Current Status')}
                            </h3>
                            <p className="text-sm text-slate-500 mb-6">
                                {!activeMandate ? 'Define a new SIP to track.' : (isStrategyEditMode ? 'Modify your SIP goals or details.' : 'Enter the totals from your monthly specific statement:')}
                            </p>

                            <form onSubmit={handleReconcileSubmit} className="space-y-6">
                                {/* Section 1: Strategy - Show if New OR Editing Strategy */}
                                {(!activeMandate || isStrategyEditMode) && (
                                    <div className="space-y-4">
                                        {!activeMandate ? (
                                            <FundSelector
                                                onSelect={(s) => { setSelectedMandateScheme(s); setReconcileForm({ ...reconcileForm, scheme_code: s.scheme_code }) }}
                                                selectedScheme={selectedMandateScheme}
                                            />
                                        ) : (
                                            <div className="bg-slate-950 border border-slate-800 rounded p-3 mb-2">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Fund</p>
                                                <p className="text-sm font-medium text-slate-200">
                                                    {selectedMandateScheme?.scheme_name || activeMandate.scheme_code}
                                                </p>
                                            </div>
                                        )}
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
                                                <label className="text-xs text-slate-500 mb-1 block">Duration (Years)</label>
                                                <input type="number" step="0.5" required className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" value={reconcileForm.duration_years} onChange={e => setReconcileForm({ ...reconcileForm, duration_years: e.target.value })} />
                                            </div>
                                        </div>

                                        {!activeMandate && (
                                            <div className="pt-2 border-t border-slate-800">
                                                <p className="text-xs text-slate-400 mb-2">Initialize Totals (Optional - if SIP is already running)</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <input type="number" placeholder="Current Invested (₹)" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm" value={reconcileForm.current_invested} onChange={e => setReconcileForm({ ...reconcileForm, current_invested: e.target.value })} />
                                                    <input type="number" step="0.001" placeholder="Current Units" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm" value={reconcileForm.current_units} onChange={e => setReconcileForm({ ...reconcileForm, current_units: e.target.value })} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Section 2: Reconciliation - Show if Active AND NOT Editing Strategy */}
                                {activeMandate && !isStrategyEditMode && (
                                    <div className="bg-slate-950/50 p-5 rounded-lg border border-slate-800">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-2 block">New Total Invested</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-3 text-slate-500">₹</span>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 pl-7 text-xl font-bold text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                        value={reconcileForm.current_invested}
                                                        onChange={e => setReconcileForm({ ...reconcileForm, current_invested: e.target.value })}
                                                        autoFocus
                                                    />
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-1.5 ml-1">
                                                    Previous: <span className="text-slate-300">₹{getMandateStats(activeMandate).totalInvested.toLocaleString()}</span>
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-2 block">New Total Units</label>
                                                <input
                                                    type="number" step="0.001"
                                                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xl font-bold text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                    value={reconcileForm.current_units}
                                                    onChange={e => setReconcileForm({ ...reconcileForm, current_units: e.target.value })}
                                                />
                                                <p className="text-[10px] text-slate-500 mt-1.5 ml-1">
                                                    Previous: <span className="text-slate-300">{getMandateStats(activeMandate).totalUnits.toFixed(3)}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Correction vs Redemption Toggle */}
                                        {((parseFloat(reconcileForm.current_invested) || 0) < getMandateStats(activeMandate).totalInvested) && (
                                            <div className="mt-6 pt-4 border-t border-slate-800/50">
                                                <div className="flex items-start gap-3 bg-red-900/10 border border-red-900/30 p-3 rounded-lg">
                                                    <div className="flex-1">
                                                        <label className="flex items-center gap-2 cursor-pointer mb-1">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-offset-slate-900"
                                                                checked={reconcileForm.isRedemption}
                                                                onChange={e => setReconcileForm({ ...reconcileForm, isRedemption: e.target.checked })}
                                                            />
                                                            <span className="text-sm font-medium text-slate-200">Record as Redemption/Sale?</span>
                                                        </label>
                                                        <p className="text-xs text-slate-400 ml-6 leading-relaxed">
                                                            {reconcileForm.isRedemption
                                                                ? "This will create a 'Sell' transaction and calculate Realized P&L."
                                                                : "This will correct past entries to match the new total (No P&L generated)."
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-6 pt-4 border-t border-slate-800/50">
                                            <label className="text-xs text-slate-500 mb-1 block">Transaction Date</label>
                                            <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-300" value={reconcileForm.latest_date} onChange={e => setReconcileForm({ ...reconcileForm, latest_date: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setMandateModalOpen(false)} className="px-6 py-2.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors">Cancel</button>
                                    <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded hover:bg-blue-500 font-medium transition-colors shadow-lg shadow-blue-900/20">
                                        {!activeMandate ? 'Create Strategy' : (isStrategyEditMode ? 'Save Changes' : 'Update & Calculate Delta')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Convert Modal */}
            {convertModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-slate-800">
                            <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                                <ArrowRightLeft className="h-5 w-5 text-amber-500" />
                                Convert SIP to Lumpsum
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                <p className="text-xs text-blue-300 leading-relaxed">
                                    This stops the active SIP tracking for <span className="text-white font-medium">{convertModal.mandate?.scheme?.scheme_name}</span>.
                                    All past SIP investments will be converted to Lumpsum holdings with the plan defined below.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400">Lumpsum Start Date</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            value={convertModal.startDate}
                                            onChange={(e) => setConvertModal({ ...convertModal, startDate: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        />
                                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400">Holding Duration (Yrs)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={convertModal.duration}
                                            onChange={(e) => setConvertModal({ ...convertModal, duration: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            placeholder="e.g. 3"
                                        />
                                        <TrendingUp className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 flex items-center gap-3">
                                <button
                                    onClick={() => setConvertModal({ ...convertModal, isOpen: false, mandate: null })}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleConvert(convertModal.mandate?.id)}
                                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-amber-900/20"
                                >
                                    Confirm Conversion
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SipTracker;
