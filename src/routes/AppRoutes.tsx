import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AuthGuard from '@/src/components/guards/AuthGuard';
import { UserType, User, FormSection } from '@/types';
import { AdminProps, EmployeeProps } from '@/src/types/props';

// Lightweight: loads immediately
import BlogPage from '@/components/BlogPage';
import BlogsPage from '@/components/BlogsPage';
import ContactPage from '@/components/ContactPage';
import CareersPage from '@/components/CareersPage';
import PrivacyPolicyPage from '@/components/PrivacyPolicyPage';
import TermsOfServicePage from '@/components/TermsOfServicePage';
import BusinessSolutionsPage from '@/components/BusinessSolutionsPage';
import BlogDashboardPage from '@/components/BlogDashboardPage';
import AboutPage from '@/components/AboutPage';

// Heavy: lazy-loaded only when needed (code-split into separate chunks)
const AdminLoginPage = React.lazy(() => import('@/components/auth/AdminLoginPage'));
const EmployeeLoginPage = React.lazy(() => import('@/components/EmployeeLoginPage'));
const EmployeeFormPage = React.lazy(() => import('@/components/EmployeeFormPage'));
const AdminPortalPage = React.lazy(() => import('@/components/AdminPortalPage'));
const EmployeeDashboardPage = React.lazy(() => import('@/components/EmployeeDashboardPage'));
const ProfileClaimPage = React.lazy(() => import('@/components/employee/ProfileClaimPage'));
const DataCorrectionPage = React.lazy(() => import('@/components/employee/DataCorrectionPage'));

// Loading spinner for lazy-loaded pages
const LazyFallback = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f9fafb' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

// Component for safe side-effect redirect to main site login
const RedirectToMainLogin: React.FC = () => {
    React.useEffect(() => {
        window.location.href = 'https://udfonline.in/login';
    }, []);
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-sans text-sm">
            Redirecting to UDF Online Login...
        </div>
    );
};

// Component for safe side-effect redirect to employee dashboard
const RedirectToEmployeeDashboard: React.FC = () => {
    React.useEffect(() => {
        window.location.href = 'https://employee.udfonline.in/dashboard';
    }, []);
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-sans text-sm">
            Redirecting to Employee Dashboard...
        </div>
    );
};

// Generic reusable component for safe side-effect redirect to subdomains
const RedirectToExternal: React.FC<{ url: string; label: string }> = ({ url, label }) => {
    React.useEffect(() => {
        const search = window.location.search || '';
        const hash = window.location.hash || '';
        window.location.href = url + search + hash;
    }, [url]);
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-sans text-sm">
            Redirecting to {label}...
        </div>
    );
};

// Plain-text static viewer for ads.txt and robots.txt to prevent SPA router redirects
const StaticFileViewer: React.FC<{ content: string }> = ({ content }) => {
    return (
        <pre style={{
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            margin: 0,
            padding: '20px',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontSize: '14px',
            minHeight: '100vh',
            boxSizing: 'border-box'
        }}>
            {content}
        </pre>
    );
};

interface AppRoutesProps {
    // Common
    isLoading: boolean;
    authUser: User | null;
    handleLogout: () => void;

    // Landing
    handleRetrieveDraft: (id: string, silent?: boolean) => Promise<boolean>;
    handleDiscardDraft: (id: string) => Promise<boolean>;
    setActiveDraft: (draft: { id: string; data: any; sectionIndex: number } | null) => void;

    // Login
    handleAdminLoginSubmit: (e: React.FormEvent) => void;
    handleGoogleLogin: () => void;
    adminUsername: string;
    setAdminUsername: (v: string) => void;
    adminPassword: string;
    setAdminPassword: (v: string) => void;
    adminLoginError: string;

    // Employee Form
    syncedSections: FormSection[];
    handleEmployeeFormSubmit: (formData: Record<string, any>, formSections: FormSection[], linkedUid?: string, onProgress?: (fieldId: string, status: 'loading' | 'done' | 'error', percent?: number) => void, legacyImportId?: string, selectedPassword?: string) => Promise<{ success: boolean; id?: string; error?: string }>;
    handleSaveDraft: (data: any, idx: number, draftId?: string) => Promise<string>;
    activeDraft: { id: string; data: any; sectionIndex: number } | null;

    // Admin Portal & Employee Dashboard Props
    adminProps: AdminProps;
    employeeProps: EmployeeProps;
}


const AppRoutes: React.FC<AppRoutesProps> = (props) => {
    const navigate = useNavigate();
    const appTarget = (import.meta as any).env?.VITE_APP_TARGET;

    // --- Referral Link Capture ---
    React.useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const refParam = params.get('ref') || params.get('referral');
            if (refParam) {
                sessionStorage.setItem('referralInviteId', refParam);
                localStorage.setItem('referralInviteId', refParam);
                import('../services/employeeService').then(srv => {
                    srv.incrementReferralClicks(refParam).catch(() => { });
                });
            }
        } catch (e) { }
    }, []);

    // --- Admin-Only App View ---
    if (appTarget === 'admin') {
        const renderAdminLogin = () => (
            <AdminLoginPage
                onLoginSubmit={props.handleAdminLoginSubmit}
                onGoogleLogin={props.handleGoogleLogin}
                adminUsername={props.adminUsername}
                setAdminUsername={props.setAdminUsername}
                adminPassword={props.adminPassword}
                setAdminPassword={props.setAdminPassword}
                loginError={props.adminLoginError}
                isLoading={props.isLoading}
            />
        );

        return (
            <Suspense fallback={<LazyFallback />}>
                <Routes>
                    <Route path="/" element={
                        props.authUser && props.authUser.type === UserType.ADMIN ? (
                            <Navigate to="/dashboard" replace />
                        ) : (
                            renderAdminLogin()
                        )
                    } />
                    <Route path="/login" element={
                        props.authUser && props.authUser.type === UserType.ADMIN ? (
                            <Navigate to="/dashboard" replace />
                        ) : (
                            renderAdminLogin()
                        )
                    } />
                    <Route path="/admin/login" element={<Navigate to="/" replace />} />
                    <Route path="/admin/dashboard" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/admin/*" element={
                        <AuthGuard allowedUserTypes={[UserType.ADMIN]}>
                            <AdminPortalPage {...props.adminProps} />
                        </AuthGuard>
                    } />
                    <Route path="/*" element={
                        <AuthGuard allowedUserTypes={[UserType.ADMIN]}>
                            <AdminPortalPage {...props.adminProps} />
                        </AuthGuard>
                    } />
                </Routes>
            </Suspense>
        );
    }

    // --- Employee-Only App View ---
    if (appTarget === 'employee') {
        const renderEmployeeLogin = () => (
            <EmployeeLoginPage
                onLoginSuccess={props.employeeProps.onLoginSuccess}
                submittedForms={props.adminProps.submittedForms}
                onNavigateToLanding={() => { window.location.href = 'https://udfonline.in'; }}
                onNavigateToAdminLogin={() => { window.location.href = 'https://admin.udfonline.in'; }}
            />
        );

        return (
            <Suspense fallback={<LazyFallback />}>
                <Routes>
                    <Route path="/" element={
                        props.authUser && props.authUser.type === UserType.EMPLOYEE ? (
                            <Navigate to="/dashboard" replace />
                        ) : (
                            renderEmployeeLogin()
                        )
                    } />
                    <Route path="/login" element={
                        props.authUser && props.authUser.type === UserType.EMPLOYEE ? (
                            <Navigate to={new URLSearchParams(window.location.search).get('redirect') || "/dashboard"} replace />
                        ) : (
                            renderEmployeeLogin()
                        )
                    } />
                    <Route path="/claim-profile" element={<ProfileClaimPage />} />
                    <Route path="/correct-details" element={<DataCorrectionPage sections={props.syncedSections} />} />
                    <Route path="/correct details" element={<DataCorrectionPage sections={props.syncedSections} />} />
                    <Route path="/join" element={
                        <EmployeeFormPage
                            sections={props.syncedSections}
                            isLoading={props.isLoading}
                            onBackToHome={() => { window.location.href = 'https://udfonline.in'; }}
                            onFormSubmit={props.handleEmployeeFormSubmit}
                            onSaveDraft={props.handleSaveDraft}
                            onRetrieveDraft={props.handleRetrieveDraft}
                            onDiscardDraft={props.handleDiscardDraft}
                            initialDraft={props.activeDraft}
                        />
                    } />
                    <Route path="/employee/dashboard" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/employee/*" element={
                        <AuthGuard allowedUserTypes={[UserType.EMPLOYEE]}>
                            <EmployeeDashboardPage {...props.employeeProps} />
                        </AuthGuard>
                    } />
                    <Route path="/*" element={
                        <AuthGuard allowedUserTypes={[UserType.EMPLOYEE]}>
                            <EmployeeDashboardPage {...props.employeeProps} />
                        </AuthGuard>
                    } />
                </Routes>
            </Suspense>
        );
    }

    // --- Standard Unified Web View (Default / Main Site) ---
    return (
        <Suspense fallback={<LazyFallback />}>
            <Routes>
                <Route path="/" element={
                    props.authUser ? (
                        props.authUser.type === UserType.ADMIN ? <Navigate to="/admin/dashboard" replace /> : <BlogPage />
                    ) : (
                        <BlogPage />
                    )
                } />

                {/* Redirect old login and portal paths to dedicated subdomains */}
                <Route path="/admin/*" element={<RedirectToExternal url="https://admin.udfonline.in" label="Admin Portal" />} />
                <Route path="/admin/login" element={<RedirectToExternal url="https://admin.udfonline.in" label="Admin Login" />} />
                <Route path="/login" element={<RedirectToExternal url="https://employee.udfonline.in/login" label="Employee Login" />} />
                <Route path="/employee/*" element={<RedirectToExternal url="https://employee.udfonline.in/dashboard" label="Employee Dashboard" />} />
                <Route path="/claim-profile" element={<RedirectToExternal url="https://employee.udfonline.in/claim-profile" label="Profile Claim" />} />
                <Route path="/correct-details" element={<RedirectToExternal url="https://employee.udfonline.in/correct-details" label="Data Correction" />} />
                <Route path="/correct details" element={<RedirectToExternal url="https://employee.udfonline.in/correct-details" label="Data Correction" />} />

                <Route path="/blogs" element={<BlogsPage />} />
                <Route path="/blogs/:postId" element={<BlogsPage />} />
                <Route path="/blog" element={<Navigate to="/blogs" replace />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/business" element={<BusinessSolutionsPage />} />
                <Route path="/dashboard" element={<BlogDashboardPage />} />
                <Route path="/services" element={<Navigate to="/business" replace />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/careers" element={<CareersPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="/terms-of-service" element={<TermsOfServicePage />} />

                <Route path="/join" element={
                    <EmployeeFormPage
                        sections={props.syncedSections}
                        isLoading={props.isLoading}
                        onBackToHome={() => { props.setActiveDraft(null); navigate('/'); }}
                        onFormSubmit={props.handleEmployeeFormSubmit}
                        onSaveDraft={props.handleSaveDraft}
                        onRetrieveDraft={props.handleRetrieveDraft}
                        onDiscardDraft={props.handleDiscardDraft}
                        initialDraft={props.activeDraft}
                    />
                } />

                {/* Static Text File Fallbacks for AdSense & Crawlers */}
                <Route path="/ads.txt" element={<StaticFileViewer content="google.com, pub-4069971667046129, DIRECT, f08c47fec0942fa0" />} />
                <Route path="/robots.txt" element={<StaticFileViewer content={`# UDF Online HR Portal - Robots.txt\n# https://udfonline.in\n\nUser-agent: *\nAllow: /\nAllow: /blogs\nAllow: /business\nAllow: /careers\nAllow: /contact\nAllow: /join\nAllow: /claim-profile\nAllow: /privacy-policy\nAllow: /terms-of-service\n\n# Block authenticated portal areas (not crawlable)\nDisallow: /admin/\nDisallow: /employee/\nDisallow: /correct-details\n\n# Sitemap\nSitemap: https://udfonline.in/sitemap.xml`} />} />
                <Route path="/llms.txt" element={<StaticFileViewer content={`# Unique Delta Force Security\n\n> Professional security guard services, smart CCTV monitoring, and corporate facility protection in India.\n\n## Public Resources\n- [Security Blogs & Guides](https://udfonline.in/blogs) - Read our guides on PF/ESI compliance, shift safety, and security technologies.\n- [Careers & Vacancies](https://udfonline.in/careers) - Explore active security jobs and join the UDF team.\n- [About Unique Delta Force](https://udfonline.in/about) - Read about our state licensing, certifications, and operational offices.\n- [Business Security Solutions](https://udfonline.in/business) - Corporate campus, industrial plant, and retail protection.\n- [Contact Our Team](https://udfonline.in/contact) - Branch office details and online inquiry lines.\n- [Privacy Policy](https://udfonline.in/privacy-policy) - Privacy policy and cookie disclosures.`} />} />
                <Route path="/google8aaac7081881f131.html" element={<StaticFileViewer content="google-site-verification: google8aaac7081881f131.html" />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
};

export default AppRoutes;

