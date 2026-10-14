import React, { useState, useEffect } from 'react';
import { Site, Vacancy, UserType, Role, Permission } from '../types';
import { useData } from '../src/contexts/DataContext';
import { getVacancies, createVacancy, updateVacancy, deleteVacancy } from '../src/services/vacancyService';
import { updateSiteDetails } from '../src/services/siteService';
import { defaultFormSections } from '../src/constants/defaults';
import { MapPin, Phone, ExternalLink, Plus, Edit2, Trash2, Save, X, Briefcase, Building, AlertCircle } from 'lucide-react';

interface AdminVacancyManagerProps {
    userRole?: Role;
    isSuperAdmin?: boolean;
    navigateTo?: (view: any) => void;
}

const AdminVacancyManager: React.FC<AdminVacancyManagerProps> = ({ userRole, isSuperAdmin = false, navigateTo }) => {
    const { sites, allowedSiteIds, authUser, sections, portalConfig } = useData();
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
    const [siteVacancies, setSiteVacancies] = useState<Vacancy[]>([]);

    // Granular Permissions
    const hasPermission = (p: Permission) => {
        if (isSuperAdmin) return true;
        const userOverrides = (authUser as any)?.permissionOverrides;
        if (userOverrides && userOverrides[p] !== undefined) {
            return !!userOverrides[p];
        }
        return userRole?.permissions?.includes(p) || false;
    };

    const canEditSiteInfo = isSuperAdmin || hasPermission(Permission.SITES_EDIT_INFO) || hasPermission(Permission.SITES_MANAGE);
    const canPostVacancy = isSuperAdmin || hasPermission(Permission.VACANCIES_POST) || hasPermission(Permission.VACANCIES_MANAGE);
    const canManageVacancies = isSuperAdmin || hasPermission(Permission.VACANCIES_MANAGE);

    // Get Designation Options from "Job Details" -> "Post of Apply"
    const designationOptions = React.useMemo(() => {
        const sourceSections = sections.length > 0 ? sections : defaultFormSections;

        const jobSection = sourceSections.find(s => s.name === "Job Details");

        const designationField = jobSection?.fields.find(f =>
            f.label.trim().toLowerCase() === "post of apply" ||
            f.label.trim().toLowerCase() === "designation" ||
            f.label.trim().toLowerCase() === "role" ||
            f.label.trim().toLowerCase() === "job title"
        );

        const allOptions = portalConfig?.designations && portalConfig.designations.length > 0
            ? portalConfig.designations
            : (designationField?.options || []);

        // Filter by Site
        const activeSite = sites.find(s => s.id === selectedSiteId);

        // PRIORITY 1: Check Site Management "Allowed Designations"
        if (activeSite && activeSite.allowedDesignations && activeSite.allowedDesignations.length > 0) {
            return allOptions.filter(opt => activeSite.allowedDesignations?.includes(opt));
        }

        // PRIORITY 2: Check Form Builder "Dependent Options" (optionsMap)
        // The keys in optionsMap are Site Names (e.g. "CAPGEMINI")
        if (activeSite && designationField?.optionsMap) {
            const siteSpecificOptions = designationField.optionsMap[activeSite.name];
            if (siteSpecificOptions && siteSpecificOptions.length > 0) {
                console.log(`DEBUG: Using Form Builder mapping for ${activeSite.name}:`, siteSpecificOptions);
                return siteSpecificOptions;
            }
        }

        return allOptions;
    }, [sections, selectedSiteId, sites, portalConfig]);

    // Site Edit State
    const [isEditingSite, setIsEditingSite] = useState(false);
    const [siteForm, setSiteForm] = useState({ address: '', googleMapsLink: '', contactNumber: '' });

    // Vacancy Edit/Create State
    const [isVacancyModalOpen, setIsVacancyModalOpen] = useState(false);
    const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
    const [vacancyForm, setVacancyForm] = useState<Partial<Vacancy>>({
        title: '', department: '', count: 1, description: '',
        salaryRange: '', type: 'Full-time', status: 'Open',
        postedDate: new Date().toISOString().split('T')[0]
    });

    const [loading, setLoading] = useState(false);

    // Filter sites based on permissions
    const visibleSites = React.useMemo(() => {
        if (!allowedSiteIds) return sites; // Admin sees all
        return sites.filter(s => allowedSiteIds.includes(s.id));
    }, [sites, allowedSiteIds]);

    useEffect(() => {
        if (selectedSiteId) {
            loadVacancies(selectedSiteId);
            const site = sites.find(s => s.id === selectedSiteId);
            if (site) {
                setSiteForm({
                    address: site.address || '',
                    googleMapsLink: site.googleMapsLink || '',
                    contactNumber: site.contactNumber || ''
                });
            }
        }
    }, [selectedSiteId, sites]);

    const loadVacancies = async (siteId: string) => {
        setLoading(true);
        try {
            const data = await getVacancies(siteId);
            setSiteVacancies(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSiteDetails = async () => {
        if (!selectedSiteId) return;
        if (!canEditSiteInfo) {
            alert("You do not have permission to edit site details.");
            return;
        }
        try {
            await updateSiteDetails(selectedSiteId, siteForm);
            setIsEditingSite(false);
            alert("Site details updated!");
        } catch (error) {
            alert("Failed to update site.");
        }
    };

    const handleSaveVacancy = async () => {
        if (!selectedSiteId) return;
        if (!canPostVacancy) {
            alert("You do not have permission to post or edit vacancies.");
            return;
        }
        const site = sites.find(s => s.id === selectedSiteId);
        if (!site) return;

        try {
            const payload = {
                ...vacancyForm,
                siteId: selectedSiteId,
                siteName: site.name,
                // Inherit site contact if not overridden (optional logic, for now simple)
            } as any;

            if (editingVacancy) {
                await updateVacancy(editingVacancy.id, payload);
            } else {
                await createVacancy(payload);
            }
            setIsVacancyModalOpen(false);
            loadVacancies(selectedSiteId);
        } catch (error) {
            alert("Failed to save vacancy.");
        }
    }

    const handleDeleteVacancy = async (id: string) => {
        if (!canManageVacancies) {
            alert("You do not have permission to delete vacancies.");
            return;
        }
        const vacToDelete = siteVacancies.find(v => v.id === id);
        if (!vacToDelete) return;
        if (confirm(`Are you sure you want to delete vacancy "${vacToDelete.title}"?`)) {
            try {
                const { moveToRecycleBin } = await import('../src/services/recycleBinService');
                const { showUndoToast } = await import('../src/utils/undoToast');
                const binId = await moveToRecycleBin({
                    itemType: 'VACANCY',
                    name: `${vacToDelete.title} (${vacToDelete.siteName || 'Site'})`,
                    originalId: vacToDelete.id,
                    originalCollection: 'vacancies',
                    data: vacToDelete,
                    deletedByUid: authUser?.uid || 'user',
                    deletedByName: authUser?.displayName || authUser?.email || 'Admin',
                    metadata: { siteId: vacToDelete.siteId, siteName: vacToDelete.siteName }
                });
                await deleteVacancy(id);
                loadVacancies(selectedSiteId!);
                showUndoToast({
                    message: `Vacancy "${vacToDelete.title}" moved to Recycle Bin`,
                    recycleBinId: binId,
                    onUndo: () => {
                        if (selectedSiteId) loadVacancies(selectedSiteId);
                    }
                });
            } catch (err: any) {
                console.error("Failed to delete vacancy:", err);
                alert("Failed to delete vacancy: " + (err.message || "Unknown error"));
            }
        }
    };

    if (!selectedSiteId) {
        return (
            <div className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Recruitment & Site Info</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Manage job openings, vacancies, and location details per operational site.
                        </p>
                    </div>
                    {navigateTo && (
                        <button
                            onClick={() => navigateTo('ADMIN_PORTAL_SITE_MANAGEMENT' as any)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
                        >
                            <Building size={16} /> Manage Sites
                        </button>
                    )}
                </div>

                {visibleSites.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center max-w-xl mx-auto my-8 shadow-xs">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Building size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No Active Operational Sites</h3>
                        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                            Job openings and recruitment posts are organized by client sites. Currently, there are no active sites configured in the database.
                        </p>
                        {navigateTo && (
                            <button
                                onClick={() => navigateTo('ADMIN_PORTAL_SITE_MANAGEMENT' as any)}
                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md"
                            >
                                <Plus size={18} /> Create First Site in Site Management
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {visibleSites.map(site => (
                            <div key={site.id}
                                onClick={() => setSelectedSiteId(site.id)}
                                className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{site.name}</h3>
                                <div className="text-sm text-gray-500 mb-4 flex items-center">
                                    <MapPin size={14} className="mr-1" /> {site.location}
                                </div>
                                <div className="flex justify-between items-center mt-4">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${site.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {site.status}
                                    </span>
                                    <span className="text-blue-600 text-sm font-medium flex items-center">
                                        {canPostVacancy || canEditSiteInfo ? 'Manage' : 'View'} <ExternalLink size={14} className="ml-1" />
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const activeSite = sites.find(s => s.id === selectedSiteId);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <button onClick={() => setSelectedSiteId(null)} className="mb-4 text-sm text-gray-500 hover:text-gray-900 flex items-center">
                ← Back to Sites
            </button>

            {/* Site Details Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{activeSite?.name}</h2>
                        <p className="text-gray-500">{activeSite?.location}</p>
                    </div>
                    {!isEditingSite ? (
                        canEditSiteInfo && (
                            <button onClick={() => setIsEditingSite(true)} className="flex items-center text-blue-600 hover:text-blue-800">
                                <Edit2 size={16} className="mr-1" /> Edit Info
                            </button>
                        )
                    ) : (
                        <div className="flex space-x-2">
                            <button onClick={() => setIsEditingSite(false)} className="text-gray-500 hover:text-gray-700">Cancel</button>
                            <button onClick={handleSaveSiteDetails} className="flex items-center bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                                <Save size={16} className="mr-1" /> Save
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400 uppercase">Address</label>
                        {isEditingSite ? (
                            <textarea
                                className="w-full text-sm p-2 border rounded"
                                value={siteForm.address}
                                onChange={e => setSiteForm({ ...siteForm, address: e.target.value })}
                                placeholder="Full site address..."
                            />
                        ) : (
                            <p className="text-gray-800 text-sm">{activeSite?.address || 'No address set'}</p>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400 uppercase">Google Maps Link</label>
                        {isEditingSite ? (
                            <input
                                className="w-full text-sm p-2 border rounded"
                                value={siteForm.googleMapsLink}
                                onChange={e => setSiteForm({ ...siteForm, googleMapsLink: e.target.value })}
                                placeholder="https://maps.google.com/..."
                            />
                        ) : (
                            activeSite?.googleMapsLink ? (
                                <a href={activeSite.googleMapsLink} target="_blank" rel="noreferrer" className="text-blue-600 text-sm flex items-center hover:underline">
                                    <MapPin size={14} className="mr-1" /> View on Map
                                </a>
                            ) : <p className="text-sm text-gray-400">No link set</p>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400 uppercase">Contact Number</label>
                        {isEditingSite ? (
                            <input
                                className="w-full text-sm p-2 border rounded"
                                value={siteForm.contactNumber}
                                onChange={e => setSiteForm({ ...siteForm, contactNumber: e.target.value })}
                                placeholder="+91..."
                            />
                        ) : (
                            <p className="text-gray-800 text-sm flex items-center">
                                <Phone size={14} className="mr-2 text-gray-400" />
                                {activeSite?.contactNumber || 'No contact set'}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Vacancies Section */}
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800 flex items-center">
                    <Briefcase className="mr-2" /> Active Vacancies
                </h3>
                {canPostVacancy && (
                    <button
                        onClick={() => {
                            setEditingVacancy(null);
                            setVacancyForm({
                                title: '', department: '', count: 1, description: '',
                                salaryRange: '', type: 'Full-time', status: 'Open',
                                postedDate: new Date().toISOString().split('T')[0]
                            });
                            setIsVacancyModalOpen(true);
                        }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center shadow-sm"
                    >
                        <Plus size={18} className="mr-1" /> Post Vacancy
                    </button>
                )}
            </div>

            <div className="grid gap-4">
                {loading ? <p>Loading...</p> : siteVacancies.length === 0 ? (
                    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-500">
                        No vacancies posted for this site yet.
                    </div>
                ) : (
                    siteVacancies.map(vacancy => (
                        <div key={vacancy.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-all">
                            <div>
                                <h4 className="font-bold text-gray-900">{vacancy.title}</h4>
                                <div className="text-sm text-gray-500 flex items-center mt-1 space-x-3">
                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{vacancy.department}</span>
                                    <span>{vacancy.count} Openings</span>
                                    <span>{vacancy.type}</span>
                                    <span className="font-medium text-gray-600">₹{vacancy.salaryRange}</span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className={`mr-4 px-2 py-1 rounded-full text-xs font-bold ${vacancy.status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {vacancy.status}
                                </span>
                                {canPostVacancy && (
                                    <button
                                        onClick={() => {
                                            setEditingVacancy(vacancy);
                                            setVacancyForm(vacancy);
                                            setIsVacancyModalOpen(true);
                                        }}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                                        title="Edit Vacancy"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                )}
                                {canManageVacancies && (
                                    <button
                                        onClick={() => handleDeleteVacancy(vacancy.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                        title="Delete Vacancy"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Vacancy Modal */}
            {isVacancyModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h3 className="text-lg font-bold">
                                {editingVacancy ? 'Edit Vacancy' : 'Post New Vacancy'}
                            </h3>
                            <button onClick={() => setIsVacancyModalOpen(false)}><X /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Job Title / Designation</label>
                                    <select
                                        className="w-full p-2 border rounded"
                                        value={vacancyForm.title}
                                        onChange={e => setVacancyForm({ ...vacancyForm, title: e.target.value })}
                                    >
                                        <option value="">Select Designation</option>
                                        {designationOptions.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Department</label>
                                    <input className="w-full p-2 border rounded" value={vacancyForm.department} onChange={e => setVacancyForm({ ...vacancyForm, department: e.target.value })} placeholder="e.g. Security" />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Openings</label>
                                    <input type="number" className="w-full p-2 border rounded" value={vacancyForm.count} onChange={e => setVacancyForm({ ...vacancyForm, count: parseInt(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Salary Range</label>
                                    <input className="w-full p-2 border rounded" value={vacancyForm.salaryRange} onChange={e => setVacancyForm({ ...vacancyForm, salaryRange: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Job Type</label>
                                    <select className="w-full p-2 border rounded" value={vacancyForm.type} onChange={e => setVacancyForm({ ...vacancyForm, type: e.target.value as any })}>
                                        <option>Full-time</option>
                                        <option>Part-time</option>
                                        <option>Contract</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Job Description</label>
                                <textarea className="w-full p-2 border rounded h-24" value={vacancyForm.description} onChange={e => setVacancyForm({ ...vacancyForm, description: e.target.value })} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Status</label>
                                    <select className="w-full p-2 border rounded" value={vacancyForm.status} onChange={e => setVacancyForm({ ...vacancyForm, status: e.target.value as any })}>
                                        <option>Open</option>
                                        <option>Closed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button onClick={() => setIsVacancyModalOpen(false)} className="px-4 py-2 text-gray-600 mr-2">Cancel</button>
                                <button onClick={handleSaveVacancy} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Vacancy</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVacancyManager;
