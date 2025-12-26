import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, PiggyBank, List, Menu, X, ChevronLeft, ChevronRight, Eye, Settings as SettingsIcon } from 'lucide-react';
import navioLogo from '../assets/logo-navio-banner.png';
import navioicon from '../assets/icon.png';
import { useState, useEffect } from 'react';
import { syncNav } from '../services/api';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Toaster, toast } from 'react-hot-toast';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();

    const navigation = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Holdings', href: '/holdings', icon: List },
        { name: 'SIP Tracker', href: '/sip', icon: TrendingUp },
        { name: 'Lumpsum', href: '/lumpsum', icon: PiggyBank },
        { name: 'Watchlist', href: '/watchlist', icon: Eye },
        { name: 'Settings', href: '/settings', icon: SettingsIcon },
    ];

    useEffect(() => {
        const performAutoSync = async () => {
            const now = new Date();
            const today = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format
            const lastSyncDate = localStorage.getItem('nav_auto_sync_date');

            if (lastSyncDate !== today) {
                console.log("Initializing daily NAV auto-sync...");
                toast.loading('Auto-syncing NAV...', { id: 'nav-sync' });
                try {
                    await syncNav();
                    localStorage.setItem('nav_auto_sync_date', today);
                    toast.dismiss('nav-sync');
                    toast.success('Daily NAV Sync Completed!');
                } catch (error) {
                    console.error("Daily NAV auto-sync failed:", error);
                    toast.dismiss('nav-sync');
                    toast.error('Daily NAV Sync Failed');
                }
            } else {
                console.log("NAV already synced today. Skipping auto-sync.");
            }
        };

        performAutoSync();
    }, []);

    return (
        <div className="h-screen bg-slate-950 text-slate-50 flex overflow-hidden">
            <Toaster position="top-right" toastOptions={{
                style: {
                    background: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                },
                // Use NAViō Logo for generic toasts
                icon: <img src={navioicon} className="h-5 w-5 object-contain" alt="NAViō" />,
                success: {
                    style: {
                        border: '1px solid #22c55e', // Green border
                        background: '#064e3b', // Dark green bg for better distinction
                        color: '#f0fdf4',
                    },
                },
                error: {
                    style: {
                        border: '1px solid #ef4444', // Red border
                        background: '#7f1d1d', // Dark red bg for better distinction
                        color: '#fef2f2',
                    },
                },
            }} />

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out flex flex-col",
                    isCollapsed ? "w-20" : "w-64",
                    !isSidebarOpen && "-translate-x-full lg:translate-x-0",
                    "lg:relative"
                )}
            >
                {/* Header with Toggle */}
                <div className={cn(
                    "h-16 flex items-center border-b border-slate-800 relative",
                    isCollapsed ? "justify-center px-0" : "justify-between px-4"
                )}>
                    <div className={cn("transition-opacity duration-300", isCollapsed ? "opacity-0 hidden" : "opacity-100")}>
                        <div className="text-xl font-bold text-blue-500 flex items-center gap-2">
                            <img src={navioLogo} alt="NAViō Logo" className="h-10 w-auto object-contain" />
                        </div>
                    </div>
                    {/* Collapsed Icon Mode */}
                    {isCollapsed && (
                        <img src={navioicon} alt="NAViō" className="h-8 w-8 object-contain" />
                    )}

                    {/* Mobile Close Button */}
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-200">
                        <X className="h-6 w-6" />
                    </button>

                    {/* Desktop Collapse Toggle */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 bg-slate-800 border border-slate-700 text-slate-400 rounded-full p-1 hover:text-white hover:bg-slate-700 transition-colors shadow-sm"
                    >
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto p-3 space-y-2">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all group relative",
                                    isActive
                                        ? "bg-blue-600 text-white"
                                        : "hover:bg-slate-800 text-slate-400 hover:text-slate-200",
                                    isCollapsed && "justify-center px-2"
                                )}
                                title={isCollapsed ? item.name : ''}
                            >
                                <Icon className={cn("shrink-0", isCollapsed ? "h-6 w-6" : "h-5 w-5")} />
                                {!isCollapsed && <span className="truncate">{item.name}</span>}

                                {/* Tooltip for Collapsed State */}
                                {isCollapsed && (
                                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-slate-200 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-slate-700 shadow-lg">
                                        {item.name}
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className={cn("p-4 border-t border-slate-800 shrink-0", isCollapsed && "flex justify-center")}>
                    {!isCollapsed ? (
                        <p className="text-xs text-slate-500">
                            🎯 App created by{' '}
                            <a
                                href="https://bio.link/shijoshaji"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                                Shijo Shaji
                            </a>
                        </p>
                    ) : (
                        <span className="text-xs text-slate-600 font-bold">©</span>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Mobile Header */}
                <div className="lg:hidden h-16 flex items-center px-4 border-b border-slate-800 bg-slate-900">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:text-slate-200">
                        <Menu className="h-6 w-6" />
                    </button>
                    <span className="ml-4 font-semibold text-slate-200">NAViō</span>
                </div>

                <div className="flex-1 overflow-auto p-4 lg:p-8">
                    <div className="w-full mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Layout;
