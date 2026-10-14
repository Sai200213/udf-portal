import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../src/context/AuthContext';
import { ExternalLink, LogOut, Menu, X, UserCircle, UserPlus, ChevronDown } from 'lucide-react';

const PublicHeader: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const handleLogoutClick = async () => {
        try {
            const { logoutUser } = await import('../../src/services/authService');
            await logoutUser();
            localStorage.removeItem('portalType');
            navigate('/');
        } catch (err) {
            console.error("Logout failed:", err);
        }
    };

    const navItems = user && user.type === 'Employee' ? [
        { path: '/', label: 'Home' },
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/blogs', label: 'Blogs' },
        { path: '/about', label: 'About Us' },
        { path: '/contact', label: 'Contact Us' }
    ] : [
        { path: '/', label: 'Home' },
        { path: '/business', label: 'Business Services' },
        { path: '/blogs', label: 'Blogs' },
        { path: '/about', label: 'About Us' },
        { path: '/careers', label: 'Careers' },
        { path: '/contact', label: 'Contact Us' }
    ];

    const isActive = (path: string) => {
        if (path.startsWith('#')) return false;
        return location.pathname === path;
    };

    const handleNavClick = (path: string) => {
        if (path.startsWith('#')) {
            if (location.pathname === '/') {
                const el = document.getElementById(path.substring(1));
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                navigate('/' + path);
                setTimeout(() => {
                    const el = document.getElementById(path.substring(1));
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 150);
            }
        } else {
            navigate(path);
        }
        setIsOpen(false);
    };

    return (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    {/* Logo Area */}
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleNavClick('/')}>
                        <img src="/logo.png" alt="Logo" className="h-9 w-auto" />
                        <span className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                            Unique Delta Force
                        </span>
                    </div>

                    {/* Desktop Navigation links */}
                    <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                        {navItems.map(item => (
                            <span
                                key={item.path}
                                onClick={() => handleNavClick(item.path)}
                                className={`text-sm font-semibold transition-all duration-200 cursor-pointer ${isActive(item.path)
                                        ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                                        : 'text-slate-600 hover:text-blue-600'
                                    }`}
                            >
                                {item.label}
                            </span>
                        ))}
                    </div>

                    {/* Right Action buttons (Desktop) */}
                    <div className="hidden md:flex items-center space-x-4">
                        {user ? (
                            <div className="relative">
                                <button
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full transition-all focus:outline-none shadow-xs"
                                >
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                                        {user.name && user.name !== 'N/A' ? user.name[0].toUpperCase() : (user.employeeId ? user.employeeId[0].toUpperCase() : 'U')}
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 max-w-[120px] truncate">
                                        {user.name && user.name !== 'N/A' ? user.name : (user.employeeId || 'User')}
                                    </span>
                                    <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Dropdown Menu */}
                                {showDropdown && (
                                    <>
                                        {/* Click outside backdrop */}
                                        <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)}></div>

                                        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-lg py-1.5 z-20 font-sans text-xs text-slate-700">
                                            {user.type !== 'Public' && (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            navigate(user.type === 'Admin' ? '/admin/dashboard' : '/employee/dashboard');
                                                            setShowDropdown(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors font-semibold flex items-center gap-2"
                                                    >
                                                        <UserCircle size={14} className="text-slate-400" />
                                                        {user.type === 'Admin' ? 'Admin Portal' : 'Employee Portal'}
                                                    </button>
                                                    <hr className="border-slate-100 my-1" />
                                                </>
                                            )}
                                            <button
                                                onClick={() => {
                                                    handleLogoutClick();
                                                    setShowDropdown(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 transition-colors font-semibold flex items-center gap-2"
                                            >
                                                <LogOut size={14} />
                                                Log Out
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => navigate('/join')}
                                    className="hidden bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-blue-700 transition-all hover:shadow-md items-center gap-1.5"
                                    style={{ display: 'none' }}
                                >
                                    <UserPlus size={14} /> Apply / Join
                                </button>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="bg-slate-900 text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-slate-800 transition-all hover:shadow-md"
                                >
                                    Login
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="text-slate-600 hover:text-blue-600 p-2"
                            aria-label="Toggle navigation menu"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Drawer Menu */}
            {isOpen && (
                <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2 shadow-inner">
                    {navItems.map(item => (
                        <div
                            key={item.path}
                            onClick={() => handleNavClick(item.path)}
                            className={`px-3 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors ${isActive(item.path)
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            {item.label}
                        </div>
                    ))}
                    <div className="border-t border-slate-100 pt-3 mt-2">
                        {user ? (
                            <div className="space-y-2.5">
                                <div className="flex items-center space-x-2.5 px-3 py-1">
                                    <UserCircle className="text-slate-400 h-6 w-6" />
                                    <span className="text-sm font-bold text-slate-700 truncate">{user.name && user.name !== 'N/A' ? user.name : (user.employeeId || 'User')}</span>
                                </div>
                                {user.type !== 'Public' && (
                                    <button
                                        onClick={() => {
                                            navigate(user.type === 'Admin' ? '/admin/dashboard' : '/employee/dashboard');
                                            setIsOpen(false);
                                        }}
                                        className="w-full bg-blue-600 text-white text-center py-2.5 rounded-xl text-sm font-bold shadow-sm"
                                    >
                                        {user.type === 'Admin' ? 'Go to Admin Portal' : 'Go to Employee Portal'}
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        handleLogoutClick();
                                        setIsOpen(false);
                                    }}
                                    className="w-full border border-slate-200 text-red-600 text-center py-2.5 rounded-xl text-sm font-bold"
                                >
                                    Log Out
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                <button
                                    onClick={() => {
                                        navigate('/join');
                                        setIsOpen(false);
                                    }}
                                    className="hidden w-full bg-blue-600 text-white text-center py-2.5 rounded-xl text-sm font-bold shadow-sm items-center justify-center gap-1.5"
                                    style={{ display: 'none' }}
                                >
                                    <UserPlus size={14} /> Apply / Join
                                </button>
                                <button
                                    onClick={() => {
                                        navigate('/login');
                                        setIsOpen(false);
                                    }}
                                    className="w-full bg-slate-900 text-white text-center py-2.5 rounded-xl text-sm font-bold shadow-sm"
                                >
                                    Login
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default PublicHeader;
