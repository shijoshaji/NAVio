import { useState, useEffect } from 'react';
import { usePrivacy } from '../context/PrivacyContext';
import { Eye, EyeOff, Shield, Users, Plus, Pencil, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import { getAccounts, addAccount, updateAccount, deleteAccount } from '../services/api';
import { toast } from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import PrivacyGuard from '../components/PrivacyGuard';

const Settings = () => {
    const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newAccount, setNewAccount] = useState('');
    const [editingAccount, setEditingAccount] = useState(null); // { id, name } original name stored in accounts list
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        id: null,
        title: '',
        message: ''
    });

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const res = await getAccounts();
            // Backend returns list of strings "['Acc1', 'Acc2']". 
            // BUT our new backend returns names.
            // Wait, previous getAccounts returned strings. New one might need object structure manipulation if we want IDs.
            // Let's check backend implementation again.
            // Backend: get_accounts returns [a.name for a in accounts].
            // So we don't have IDs in get_accounts response!
            // We need to update get_accounts backend to return objects {id, name} or handle by name.
            // The DELETE/UPDATE endpoints require ID.
            // I should have checked backend return type.
            // Let's assume for now I will need to fix backend to return objects.
            // Or I can use strings if I change backend to accept names.
            // Actually, best to fix backend to return objects {id, name}.

            // Re-reading main.py changes I tried to apply:
            // @app.get("/api/accounts") ... return [a.name for a in accounts]
            // This is BAD for frontend management.
            // I should fix backend main.py to return full objects.

            // For now, let's implement the UI assuming backend returns objects, 
            // and I will fix backend in next step immediately.
            setAccounts(res.data);
        } catch (error) {
            console.error("Failed to fetch accounts", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAccount = async (e) => {
        e.preventDefault();
        if (!newAccount.trim()) return;
        try {
            await addAccount(newAccount);
            setNewAccount('');
            fetchAccounts();
            toast.success('Account added');
        } catch (error) {
            toast.error('Failed to add account');
        }
    };

    const handleUpdateAccount = async (id, newName) => {
        if (!newName.trim()) return;
        try {
            await updateAccount(id, newName);
            setEditingAccount(null);
            fetchAccounts();
            toast.success('Account updated');
        } catch (error) {
            toast.error('Failed to update account');
        }
    };

    const handleDeleteAccount = (id) => {
        setConfirmModal({
            isOpen: true,
            id: id,
            title: 'Delete Account?',
            message: 'Are you sure you want to delete this account? This action cannot be undone.'
        });
    };

    const confirmDeleteAccount = async () => {
        if (!confirmModal.id) return;
        try {
            await deleteAccount(confirmModal.id);
            fetchAccounts();
            toast.success('Account deleted');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete account');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight text-white">Settings</h2>
            </div>

            <div className="bg-slate-900 text-slate-50 rounded-lg border border-slate-800 shadow-sm p-6">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-400" />
                    General Settings
                </h3>

                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 font-medium text-slate-200">
                                {isPrivacyMode ? <EyeOff className="h-4 w-4 text-amber-500" /> : <Eye className="h-4 w-4 text-blue-500" />}
                                Privacy Mode
                            </div>
                            <p className="text-sm text-slate-400">
                                Blur financial values across the application for privacy.
                            </p>
                        </div>

                        <button
                            onClick={togglePrivacyMode}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${isPrivacyMode ? 'bg-blue-600' : 'bg-slate-700'
                                }`}
                        >
                            <span
                                className={`${isPrivacyMode ? 'translate-x-6' : 'translate-x-1'
                                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Account Management Section */}
            <div className="bg-slate-900 text-slate-50 rounded-lg border border-slate-800 shadow-sm p-6">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-400" />
                    Managed Accounts
                </h3>

                <div className="space-y-6">
                    <p className="text-sm text-slate-400">
                        Define the accounts (e.g., Family members, Portfolios) you want to track.
                        Investments can be assigned to these accounts.
                    </p>

                    {/* Add New */}
                    <form onSubmit={handleAddAccount} className="flex gap-2">
                        <input
                            type="text"
                            className="flex h-10 w-full max-w-sm rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="Enter new account name..."
                            value={newAccount}
                            onChange={(e) => setNewAccount(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={!newAccount.trim()}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-emerald-600 text-white h-10 px-4 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add
                        </button>
                    </form>

                    {/* List */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {loading ? (
                            <div className="text-slate-500 text-sm">Loading accounts...</div>
                        ) : accounts.length === 0 ? (
                            <div className="text-slate-500 text-sm">No accounts defined.</div>
                        ) : (
                            accounts.map((acc) => {
                                const accName = typeof acc === 'object' ? acc.name : acc;
                                const accId = typeof acc === 'object' ? acc.id : acc;
                                const itemCount = typeof acc === 'object' ? (acc.item_count || 0) : 0;
                                return (
                                    <div key={accId} className="flex items-center justify-between p-3 bg-slate-950 rounded border border-slate-800 group">
                                        {editingAccount?.id === (acc.id || acc) ? (
                                            <div className="flex gap-2 w-full">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    className="flex-1 h-8 bg-slate-900 border border-slate-700 rounded px-2 text-sm text-white"
                                                    value={editingAccount.name}
                                                    onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                                                />
                                                <button onClick={() => handleUpdateAccount(accId, editingAccount.name)} className="text-green-500 hover:bg-slate-900 p-1 rounded"><Check className="h-4 w-4" /></button>
                                                <button onClick={() => setEditingAccount(null)} className="text-red-500 hover:bg-slate-900 p-1 rounded"><X className="h-4 w-4" /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                                        <PrivacyGuard>{(acc.name || acc).charAt(0).toUpperCase()}</PrivacyGuard>
                                                    </div>
                                                    <span className="font-medium text-slate-200"><PrivacyGuard>{accName}</PrivacyGuard></span>
                                                </div>

                                                {/* Default account usually cannot be deleted/edited easily or needs checks */}
                                                {/* Assuming backend returns objects with ID now. If string, these buttons break. */}
                                                <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditingAccount({ id: accId, name: accName })} className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-900 rounded"><Pencil className="h-3.5 w-3.5" /></button>
                                                    {accName !== 'Default' && (
                                                        <button
                                                            onClick={() => handleDeleteAccount(accId)}
                                                            disabled={itemCount > 0}
                                                            title={itemCount > 0 ? `Cannot delete: ${itemCount} active funds linked` : "Delete Account"}
                                                            className={`p-1 rounded ${itemCount > 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:text-red-400 hover:bg-slate-900'}`}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmDeleteAccount}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText="Delete"
                isDanger={true}
            />

            {/* <div className="text-center text-xs text-slate-500 mt-10">
                Mutual Fund Tracker v1.0
            </div> */}
        </div>
    );
};

export default Settings;
