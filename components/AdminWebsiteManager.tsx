import React, { useState, useEffect } from 'react';
import { getWebsiteConfig, updateWebsiteConfig, WebsiteServiceData } from '../src/services/websiteService';
import { getBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost, BlogPost } from '../src/services/blogService';
import { uploadFile } from '../src/services/storageService';
import { Edit, Trash, Plus, Globe, Settings, PlusCircle, Save, BookOpen, MapPin, Shield, CheckCircle, Info, ClipboardCheck, HelpCircle, Trophy, UserCheck, MessageSquare, Gift, ShoppingBag, Sparkles, Activity, Database, UploadCloud, Sliders, Lock, Unlock, RefreshCw } from 'lucide-react';
import { db } from '../src/firebase/config';
import { collection, getDocs, getDoc, doc, query, orderBy, where, updateDoc, setDoc, deleteDoc, addDoc, onSnapshot } from 'firebase/firestore';
import { sanitizeHtml } from '../src/utils/sanitizeHtml';

const getFormattedImageUrl = (url?: string) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
        return trimmed;
    }
    return `/${trimmed}`;
};

const AdminWebsiteManager: React.FC<{ isSuperAdmin: boolean; userRole?: any }> = ({ isSuperAdmin, userRole }) => {
    const [activeTab, setActiveTab] = useState<'blogs' | 'about_services' | 'contact_careers' | 'grievances' | 'attendance' | 'quizzes' | 'rewards_rules' | 'usage_billing'>('blogs');
    const [webConfig, setWebConfig] = useState<WebsiteServiceData | null>(null);

    // Usage & Billing States
    const [metrics, setMetrics] = useState<any>(null);
    const [loadingMetrics, setLoadingMetrics] = useState(false);
    const [portalConfig, setPortalConfig] = useState<any>(null);

    const fetchMetrics = async () => {
        setLoadingMetrics(true);
        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const getSystemMetrics = httpsCallable(getFunctions(), 'getSystemMetrics');
            const result = await getSystemMetrics();
            setMetrics(result.data);
        } catch (err) {
            console.error("Failed to load system metrics:", err);
        } finally {
            setLoadingMetrics(false);
        }
    };

    const updatePortalConfigField = async (field: string, value: any) => {
        try {
            await updateDoc(doc(db, 'settings', 'portal_config'), {
                [field]: value
            });
            setMessage('Safeguard configuration updated.');
            setTimeout(() => setMessage(''), 3000);
        } catch (err: any) {
            console.error("Failed to update config field:", err);
            alert(`Failed to save config: ${err.message}`);
        }
    };

    useEffect(() => {
        if (activeTab === 'usage_billing') {
            const unsub = onSnapshot(doc(db, 'settings', 'portal_config'), (snap) => {
                if (snap.exists()) {
                    setPortalConfig(snap.data());
                }
            });
            fetchMetrics();
            return () => unsub();
        }
    }, [activeTab]);
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Modal state for blog edit/create
    const [isBlogModalOpen, setIsBlogModalOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
    const [blogTitle, setBlogTitle] = useState('');
    const [blogCategory, setBlogCategory] = useState('Guides');
    const [blogDate, setBlogDate] = useState('');
    const [blogReadTime, setBlogReadTime] = useState('');
    const [blogExcerpt, setBlogExcerpt] = useState('');
    const [blogContent, setBlogContent] = useState('');
    const [blogImageUrl, setBlogImageUrl] = useState('');
    const [blogIsPinned, setBlogIsPinned] = useState(false);
    const [blogIsPrivate, setBlogIsPrivate] = useState(false);
    const [blogEditMode, setBlogEditMode] = useState<'write' | 'preview'>('write');

    // Grievances State
    const [grievances, setGrievances] = useState<any[]>([]);
    const [selectedGrievance, setSelectedGrievance] = useState<any | null>(null);
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
    const [adminResponseText, setAdminResponseText] = useState('');
    const [resolutionStatus, setResolutionStatus] = useState('Resolved');

    // Attendance State
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    // Safety Quizzes State
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState<any | null>(null);
    const [quizQuestionText, setQuizQuestionText] = useState('');
    const [optionA, setOptionA] = useState('');
    const [optionB, setOptionB] = useState('');
    const [optionC, setOptionC] = useState('');
    const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C'>('B');
    const [quizExplanation, setQuizExplanation] = useState('');

    // Rules State
    const [attendancePoints, setAttendancePoints] = useState<number>(5);
    const [quizPoints, setQuizPoints] = useState<number>(10);
    const [streakPoints, setStreakPoints] = useState<number>(1);
    const [rulesRewards, setRulesRewards] = useState<any[]>([
        { id: 'cap', name: 'UDF Branded Security Cap', cost: 300 },
        { id: 'bottle', name: 'Stainless Steel Water Bottle', cost: 500 },
        { id: 'jacket', name: 'Premium Warm Winter Jacket', cost: 1200 }
    ]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [config, blogs] = await Promise.all([
                getWebsiteConfig(),
                getBlogPosts()
            ]);
            setWebConfig(config);
            setPosts(blogs);

            await Promise.all([
                loadGrievances(),
                loadAttendanceRecords(),
                loadQuizzes(),
                loadRules()
            ]);
        } catch (err) {
            console.error("Failed to load admin website config:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadGrievances = async () => {
        try {
            const snap = await getDocs(query(collection(db, 'complaints'), orderBy('timestamp', 'desc')));
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGrievances(list);
        } catch (err) {
            console.error("Failed to load grievances:", err);
        }
    };

    const loadAttendanceRecords = async () => {
        try {
            const snap = await getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc')));
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAttendanceRecords(list);
        } catch (err) {
            console.error("Failed to load attendance logs:", err);
        }
    };

    const loadQuizzes = async () => {
        try {
            const snap = await getDocs(query(collection(db, 'safety_quizzes'), orderBy('createdAt', 'desc')));
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setQuizzes(list);
        } catch (err) {
            console.error("Failed to load safety quizzes:", err);
        }
    };

    const loadRules = async () => {
        try {
            const rulesRef = doc(db, 'settings', 'gamification_rules');
            const rulesSnap = await getDoc(rulesRef);
            if (rulesSnap.exists()) {
                const data = rulesSnap.data() as any;
                setAttendancePoints(data.attendancePoints ?? 5);
                setQuizPoints(data.quizPoints ?? 10);
                setStreakPoints(data.streakPoints ?? 1);
                setRulesRewards(data.rewards ?? [
                    { id: 'cap', name: 'UDF Branded Security Cap', cost: 300 },
                    { id: 'bottle', name: 'Stainless Steel Water Bottle', cost: 500 },
                    { id: 'jacket', name: 'Premium Warm Winter Jacket', cost: 1200 }
                ]);
            }
        } catch (err) {
            console.error("Failed to load point rules:", err);
        }
    };

    const handleResolveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGrievance) return;
        setSaving(true);
        try {
            const ref = doc(db, 'complaints', selectedGrievance.id);
            await updateDoc(ref, {
                status: resolutionStatus,
                adminResponse: adminResponseText.trim(),
                resolvedAt: new Date().toISOString()
            });
            setMessage('Grievance updated successfully!');
            await loadGrievances();
            setIsResolveModalOpen(false);
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            console.error("Failed to resolve grievance:", err);
            alert("Failed to save resolution");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveQuiz = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                question: quizQuestionText.trim(),
                optionA: optionA.trim(),
                optionB: optionB.trim(),
                optionC: optionC.trim(),
                correctAnswer,
                explanation: quizExplanation.trim(),
                createdAt: new Date().toISOString()
            };

            if (editingQuiz) {
                const ref = doc(db, 'safety_quizzes', editingQuiz.id);
                await updateDoc(ref, payload);
            } else {
                await addDoc(collection(db, 'safety_quizzes'), payload);
            }

            setMessage('Quiz question saved successfully!');
            await loadQuizzes();
            setIsQuizModalOpen(false);
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            console.error("Failed to save quiz:", err);
            alert("Failed to save quiz question");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteQuiz = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this safety quiz question?")) return;
        try {
            await deleteDoc(doc(db, 'safety_quizzes', id));
            setMessage('Quiz question deleted successfully.');
            await loadQuizzes();
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            console.error("Failed to delete quiz:", err);
        }
    };

    const handleSaveRules = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const rulesRef = doc(db, 'settings', 'gamification_rules');
            await setDoc(rulesRef, {
                attendancePoints: Number(attendancePoints),
                quizPoints: Number(quizPoints),
                streakPoints: Number(streakPoints),
                rewards: rulesRewards
            });
            setMessage('Rules and rewards config saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            console.error("Failed to save point rules:", err);
            alert("Failed to save rules");
        } finally {
            setSaving(false);
        }
    };

    const updateRewardCost = (id: string, cost: number) => {
        setRulesRewards(prev => prev.map(r => r.id === id ? { ...r, cost } : r));
    };

    const updateRewardName = (id: string, name: string) => {
        setRulesRewards(prev => prev.map(r => r.id === id ? { ...r, name } : r));
    };

    // Save Website Configuration (About, Services, Contact, Careers)
    const handleSaveConfig = async () => {
        if (!webConfig) return;
        setSaving(true);
        setMessage('');
        try {
            await updateWebsiteConfig(webConfig);
            setMessage('Website settings updated successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            console.error(err);
            setMessage('Failed to update settings.');
        } finally {
            setSaving(false);
        }
    };

    // Open blog post form modal (Create)
    const handleCreateBlogClick = () => {
        setEditingPost(null);
        setBlogTitle('');
        setBlogCategory('Guides');
        
        // Default today's date format for display
        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        setBlogDate(formattedDate);
        setBlogReadTime('5 min read');
        setBlogExcerpt('');
        setBlogContent('');
        setBlogImageUrl('');
        setBlogIsPinned(false);
        setBlogIsPrivate(false);
        setBlogEditMode('write');
        setIsBlogModalOpen(true);
    };

    // Open blog post form modal (Edit)
    const handleEditBlogClick = (post: BlogPost) => {
        setEditingPost(post);
        setBlogTitle(post.title);
        setBlogCategory(post.category);
        setBlogDate(post.date);
        setBlogReadTime(post.readTime);
        setBlogExcerpt(post.excerpt);
        setBlogContent(post.content);
        setBlogImageUrl(post.imageUrl || '');
        setBlogIsPinned(post.isPinned || false);
        setBlogIsPrivate(post.isPrivate || false);
        setBlogEditMode('write');
        setIsBlogModalOpen(true);
    };

    // Save Blog Post (Create or Update)
    const handleSaveBlog = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            const blogData = {
                title: blogTitle.trim(),
                category: blogCategory,
                date: blogDate.trim(),
                readTime: blogReadTime.trim(),
                excerpt: blogExcerpt.trim(),
                content: blogContent.trim(),
                imageUrl: blogImageUrl.trim(),
                isPinned: blogIsPinned,
                isPrivate: blogIsPrivate
            };

            if (editingPost) {
                await updateBlogPost(editingPost.id, blogData);
                setMessage('Blog post updated successfully!');
            } else {
                await createBlogPost(blogData);
                setMessage('Blog post published successfully!');
            }
            
            setIsBlogModalOpen(false);
            await loadData();
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            console.error(err);
            setMessage('Failed to save blog post.');
        } finally {
            setSaving(false);
        }
    };

    // Delete Blog Post
    const handleDeleteBlogClick = async (post: BlogPost) => {
        if (!window.confirm(`Are you sure you want to delete "${post.title}" and remove its picture?`)) return;
        setSaving(true);
        try {
            await deleteBlogPost(post.id, post.imageUrl);
            setMessage('Blog post and associated picture deleted successfully.');
            await loadData();
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            console.error(err);
            setMessage('Failed to delete blog post.');
        } finally {
            setSaving(false);
        }
    };

    const insertTextAtCursor = (textToInsert: string) => {
        const textarea = document.getElementById('blog-content-textarea') as HTMLTextAreaElement;
        if (!textarea) {
            // Fallback if textarea is not in DOM
            setBlogContent(prev => prev + textToInsert);
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentContent = blogContent;

        const newContent = currentContent.substring(0, start) + textToInsert + currentContent.substring(end);
        setBlogContent(newContent);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
        }, 10);
    };

    const wrapTextAtCursor = (openTag: string, closeTag: string) => {
        const textarea = document.getElementById('blog-content-textarea') as HTMLTextAreaElement;
        if (!textarea) {
            // Fallback if textarea is not in DOM
            setBlogContent(prev => prev + openTag + 'text' + closeTag);
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentContent = blogContent;
        const selectedText = currentContent.substring(start, end);

        const textToInsert = `${openTag}${selectedText || 'text'}${closeTag}`;
        const newContent = currentContent.substring(0, start) + textToInsert + currentContent.substring(end);
        setBlogContent(newContent);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + openTag.length, start + openTag.length + (selectedText || 'text').length);
        }, 10);
    };

    // Helper to update website configuration fields nested or lists
    const updateConfigField = (field: keyof WebsiteServiceData, value: any) => {
        if (!webConfig) return;
        setWebConfig({
            ...webConfig,
            [field]: value
        });
    };

    // Services list helpers
    const handleServiceChange = (index: number, field: string, value: string) => {
        if (!webConfig) return;
        const list = [...webConfig.services];
        list[index] = { ...list[index], [field]: value };
        updateConfigField('services', list);
    };

    const handleAddService = () => {
        if (!webConfig) return;
        const newService = {
            id: `srv-${Date.now()}`,
            title: 'New Service Title',
            description: 'Enter service description details here.',
            icon: 'Shield'
        };
        updateConfigField('services', [...webConfig.services, newService]);
    };

    const handleRemoveService = (index: number) => {
        if (!webConfig) return;
        const list = webConfig.services.filter((_, i) => i !== index);
        updateConfigField('services', list);
    };

    // Careers benefits list helpers
    const handleBenefitChange = (index: number, value: string) => {
        if (!webConfig) return;
        const list = [...webConfig.careersBenefits];
        list[index] = value;
        updateConfigField('careersBenefits', list);
    };

    const handleAddBenefit = () => {
        if (!webConfig) return;
        updateConfigField('careersBenefits', [...webConfig.careersBenefits, '']);
    };

    const handleRemoveBenefit = (index: number) => {
        if (!webConfig) return;
        const list = webConfig.careersBenefits.filter((_, i) => i !== index);
        updateConfigField('careersBenefits', list);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-24">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 font-sans">
            {/* Top Status Notification Banner */}
            {message && (
                <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-xs transition-all ${
                    message.includes('success') || message.includes('published') || message.includes('deleted')
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                    <Info size={16} />
                    <span>{message}</span>
                </div>
            )}

            {/* Layout Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 border rounded-2xl shadow-2xs">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Globe className="text-blue-600 h-5 w-5" /> Website Content & Blogs Manager
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Manage public landing pages, security services, careers info, and blog posts.</p>
                </div>
                {(activeTab === 'about_services' || activeTab === 'contact_careers') && (
                    <button
                        onClick={handleSaveConfig}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
                    >
                        <Save size={14} /> {saving ? 'Saving...' : 'Save Public Layouts'}
                    </button>
                )}
            </div>

            {/* Menu Tabs */}
            <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('blogs')}
                    className={`pb-3 px-5 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                        activeTab === 'blogs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Blog Post Scheduler
                </button>
                <button
                    onClick={() => setActiveTab('about_services')}
                    className={`pb-3 px-5 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                        activeTab === 'about_services' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    About Us & Services
                </button>
                <button
                    onClick={() => setActiveTab('contact_careers')}
                    className={`pb-3 px-5 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                        activeTab === 'contact_careers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Contact & Careers
                </button>
                <button
                    onClick={() => setActiveTab('grievances')}
                    className={`pb-3 px-5 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                        activeTab === 'grievances' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Grievances
                </button>
                <button
                    onClick={() => setActiveTab('attendance')}
                    className={`pb-3 px-5 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                        activeTab === 'attendance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Attendance Logs
                </button>
                <button
                    onClick={() => setActiveTab('quizzes')}
                    className={`pb-3 px-5 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                        activeTab === 'quizzes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Safety Quizzes
                </button>
                <button
                    onClick={() => setActiveTab('rewards_rules')}
                    className={`pb-3 px-5 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                        activeTab === 'rewards_rules' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Gamification & Rules
                </button>
                {isSuperAdmin && (
                    <button
                        onClick={() => setActiveTab('usage_billing')}
                        className={`pb-3 px-5 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                            activeTab === 'usage_billing' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Usage & Billing
                    </button>
                )}
            </div>

            {/* Tab 1: Blogs posts management */}
            {activeTab === 'blogs' && (
                <div className="bg-white border rounded-2xl p-6 shadow-2xs">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Public Blog Posts</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Roster of articles displayed on the homepage.</p>
                        </div>
                        <button
                            onClick={handleCreateBlogClick}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1 shadow-sm transition-all"
                        >
                            <PlusCircle size={14} /> Add Blog Post
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                    <th className="p-3">Title</th>
                                    <th className="p-3">Category</th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Read Time</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {posts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400">No blog posts found.</td>
                                    </tr>
                                ) : (
                                    posts.map(post => (
                                        <tr key={post.id} className="border-b hover:bg-slate-50/50">
                                            <td className="p-3 font-bold text-slate-900 truncate max-w-xs">{post.title}</td>
                                            <td className="p-3">
                                                <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                                    {post.category}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-500 font-semibold">{post.date}</td>
                                            <td className="p-3 text-slate-500 font-semibold">{post.readTime}</td>
                                            <td className="p-3 text-right space-x-2">
                                                <button
                                                    onClick={() => handleEditBlogClick(post)}
                                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Edit Post"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteBlogClick(post)}
                                                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Delete Post"
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab 2: About & Services Details */}
            {activeTab === 'about_services' && webConfig && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* About Us Card */}
                    <div className="bg-white border rounded-2xl p-6 shadow-2xs space-y-4">
                        <h3 className="text-base font-bold text-slate-800 border-b pb-2 mb-2 flex items-center gap-1.5">
                            <BookOpen size={16} className="text-blue-600" /> About Company Text
                        </h3>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Intro/Banner Title</label>
                            <input
                                type="text"
                                value={webConfig.aboutIntroTitle}
                                onChange={(e) => updateConfigField('aboutIntroTitle', e.target.value)}
                                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Company Story (Paragraph 1)</label>
                            <textarea
                                value={webConfig.aboutStoryText1}
                                onChange={(e) => updateConfigField('aboutStoryText1', e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Company Story (Paragraph 2)</label>
                            <textarea
                                value={webConfig.aboutStoryText2}
                                onChange={(e) => updateConfigField('aboutStoryText2', e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Active Guards Stat</label>
                                <input
                                    type="number"
                                    value={webConfig.aboutActiveOfficersCount}
                                    onChange={(e) => updateConfigField('aboutActiveOfficersCount', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Secured Sites Stat</label>
                                <input
                                    type="number"
                                    value={webConfig.aboutSecuredSitesCount}
                                    onChange={(e) => updateConfigField('aboutSecuredSitesCount', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Security Services Card */}
                    <div className="bg-white border rounded-2xl p-6 shadow-2xs space-y-4">
                        <div className="flex justify-between items-center border-b pb-2 mb-2">
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                                <Shield size={16} className="text-blue-600" /> Dynamic Services List
                            </h3>
                            <button
                                onClick={handleAddService}
                                className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-0.5"
                            >
                                <Plus size={14} /> Add Service
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                            {webConfig.services.map((srv, idx) => (
                                <div key={srv.id} className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-3 relative">
                                    <button
                                        onClick={() => handleRemoveService(idx)}
                                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xs"
                                        title="Remove Service"
                                    >
                                        <Trash size={14} />
                                    </button>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2">
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Service Title</label>
                                            <input
                                                type="text"
                                                value={srv.title}
                                                onChange={(e) => handleServiceChange(idx, 'title', e.target.value)}
                                                className="w-full px-2 py-1 text-xs border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Icon ID</label>
                                            <select
                                                value={srv.icon}
                                                onChange={(e) => handleServiceChange(idx, 'icon', e.target.value)}
                                                className="w-full px-2 py-1 text-xs border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            >
                                                <option value="Shield">Shield</option>
                                                <option value="Eye">Eye / CCTV</option>
                                                <option value="Users">Users / Patrol</option>
                                                <option value="ShieldCheck">Checked Shield</option>
                                                <option value="Award">Award</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Description Summary</label>
                                        <textarea
                                            value={srv.description}
                                            onChange={(e) => handleServiceChange(idx, 'description', e.target.value)}
                                            rows={2}
                                            className="w-full px-2 py-1 text-xs border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-600"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 3: Contact & Careers Pitch */}
            {activeTab === 'contact_careers' && webConfig && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Contact Details Card */}
                    <div className="bg-white border rounded-2xl p-6 shadow-2xs space-y-4">
                        <h3 className="text-base font-bold text-slate-800 border-b pb-2 mb-2 flex items-center gap-1.5">
                            <MapPin size={16} className="text-blue-600" /> Contact Coordinates
                        </h3>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Corporate Office Address</label>
                            <textarea
                                value={webConfig.contactAddress}
                                onChange={(e) => updateConfigField('contactAddress', e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Support Hotline Phone</label>
                            <input
                                type="text"
                                value={webConfig.contactPhone}
                                onChange={(e) => updateConfigField('contactPhone', e.target.value)}
                                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Official Inquiry Email</label>
                            <input
                                type="email"
                                value={webConfig.contactEmail}
                                onChange={(e) => updateConfigField('contactEmail', e.target.value)}
                                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Weekdays Hours</label>
                                <input
                                    type="text"
                                    value={webConfig.contactHoursWeekdays}
                                    onChange={(e) => updateConfigField('contactHoursWeekdays', e.target.value)}
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sunday Status</label>
                                <input
                                    type="text"
                                    value={webConfig.contactHoursSunday}
                                    onChange={(e) => updateConfigField('contactHoursSunday', e.target.value)}
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Careers Page Text Details */}
                    <div className="bg-white border rounded-2xl p-6 shadow-2xs space-y-4">
                        <h3 className="text-base font-bold text-slate-800 border-b pb-2 mb-2 flex items-center gap-1.5">
                            <PlusCircle size={16} className="text-blue-600" /> Careers Pitch & Benefits
                        </h3>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Careers Title Banner</label>
                            <input
                                type="text"
                                value={webConfig.careersTitle}
                                onChange={(e) => updateConfigField('careersTitle', e.target.value)}
                                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Careers Subtitle</label>
                            <input
                                type="text"
                                value={webConfig.careersSubtitle}
                                onChange={(e) => updateConfigField('careersSubtitle', e.target.value)}
                                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Careers Pitch/Intro Paragraph</label>
                            <textarea
                                value={webConfig.careersPitch}
                                onChange={(e) => updateConfigField('careersPitch', e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                            />
                        </div>

                        {/* Benefits list editing */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Careers Benefits Bullet List</label>
                                <button
                                    onClick={handleAddBenefit}
                                    className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-0.5"
                                >
                                    <Plus size={12} /> Add Bullet
                                </button>
                            </div>
                            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                {webConfig.careersBenefits.map((benefit, idx) => (
                                    <div key={idx} className="flex items-center space-x-2">
                                        <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                                        <input
                                            type="text"
                                            value={benefit}
                                            onChange={(e) => handleBenefitChange(idx, e.target.value)}
                                            placeholder="Enter benefit description..."
                                            className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
                                        />
                                        <button
                                            onClick={() => handleRemoveBenefit(idx)}
                                            className="text-slate-400 hover:text-red-500 flex-shrink-0"
                                            title="Remove Bullet"
                                        >
                                            <Trash size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 4: Grievances */}
            {activeTab === 'grievances' && (
                <div className="bg-white border rounded-2xl p-6 shadow-2xs">
                    <div className="mb-6">
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <MessageSquare className="text-blue-600 h-5 w-5" /> Grievance Desk
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Review and resolve issues submitted by field officers.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Employee Name</th>
                                    <th className="p-3">Grievance Description</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Admin Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grievances.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400">No grievances found.</td>
                                    </tr>
                                ) : (
                                    grievances.map((g) => (
                                        <tr key={g.id} className="border-b hover:bg-slate-50/50">
                                            <td className="p-3 text-slate-500 font-semibold whitespace-nowrap">
                                                {g.timestamp ? new Date(g.timestamp.seconds * 1000).toLocaleDateString() : 'N/A'}
                                            </td>
                                            <td className="p-3 font-bold text-slate-800">{g.userName || 'Employee'} (ID: {g.userId})</td>
                                            <td className="p-3 text-slate-600 max-w-sm break-words">{g.text}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    g.status === 'Resolved' ? 'bg-green-50 text-green-700' :
                                                    g.status === 'Investigating' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                                                }`}>
                                                    {g.status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="p-3 space-y-1">
                                                <button
                                                    onClick={() => {
                                                        setSelectedGrievance(g);
                                                        setAdminResponseText(g.adminResponse || '');
                                                        setResolutionStatus(g.status || 'Resolved');
                                                        setIsResolveModalOpen(true);
                                                    }}
                                                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold px-3 py-1.5 rounded-lg text-[10px] transition-colors"
                                                >
                                                    Update Status
                                                </button>
                                                {g.adminResponse && (
                                                    <p className="text-[10px] text-slate-400 italic max-w-xs truncate">Resp: {g.adminResponse}</p>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab 5: Attendance Logs */}
            {activeTab === 'attendance' && (
                <div className="bg-white border rounded-2xl p-6 shadow-2xs">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <ClipboardCheck className="text-emerald-600 h-5 w-5" /> Attendance Logs
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Track field officer check-ins and feedback.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                            <input
                                type="text"
                                placeholder="Search Name or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                            />
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                    <th className="p-3">Check-in Date</th>
                                    <th className="p-3">Employee Name</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Feedback Comments / Ideas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attendanceRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400">No attendance logs found.</td>
                                    </tr>
                                ) : (
                                    attendanceRecords
                                        .filter(r => {
                                            const matchesSearch = !searchQuery || 
                                                r.userName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                r.userId?.toLowerCase().includes(searchQuery.toLowerCase());
                                            const matchesDate = !dateFilter || r.date === dateFilter;
                                            return matchesSearch && matchesDate;
                                        })
                                        .map((r) => (
                                            <tr key={r.id} className="border-b hover:bg-slate-50/50">
                                                <td className="p-3 text-slate-500 font-semibold whitespace-nowrap">{r.date}</td>
                                                <td className="p-3 font-bold text-slate-800">{r.userName || 'Employee'} (ID: {r.userId})</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        r.status === 'P' ? 'bg-emerald-50 text-emerald-700' :
                                                        r.status === 'W/O' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                                                    }`}>
                                                        {r.status === 'P' ? 'Present' : r.status === 'W/O' ? 'Weekly Off' : 'Absent'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-slate-650 font-semibold italic">{r.idea || '-'}</td>
                                            </tr>
                                        ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab 6: Safety Quizzes */}
            {activeTab === 'quizzes' && (
                <div className="bg-white border rounded-2xl p-6 shadow-2xs">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <HelpCircle className="text-blue-600 h-5 w-5" /> Safety Quiz Scheduler
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Manage daily quiz questions displayed to guards.</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingQuiz(null);
                                setQuizQuestionText('');
                                setOptionA('');
                                setOptionB('');
                                setOptionC('');
                                setCorrectAnswer('B');
                                setQuizExplanation('');
                                setIsQuizModalOpen(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1 shadow-sm transition-all"
                        >
                            <PlusCircle size={14} /> Add Quiz Question
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                    <th className="p-3">Quiz Question</th>
                                    <th className="p-3">Options (A / B / C)</th>
                                    <th className="p-3">Correct Answer</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quizzes.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400">
                                            No custom quiz questions found. Displaying system default question.
                                        </td>
                                    </tr>
                                ) : (
                                    quizzes.map((q) => (
                                        <tr key={q.id} className="border-b hover:bg-slate-50/50">
                                            <td className="p-3 font-bold text-slate-850 max-w-sm">
                                                <div>{q.question}</div>
                                                <div className="text-[10px] text-slate-400 font-semibold italic mt-1">{q.explanation}</div>
                                            </td>
                                            <td className="p-3 space-y-0.5 text-slate-500">
                                                <div>A. {q.optionA}</div>
                                                <div>B. {q.optionB}</div>
                                                <div>C. {q.optionC}</div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md font-extrabold text-[10px]">
                                                    Option {q.correctAnswer}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right space-x-2 whitespace-nowrap">
                                                <button
                                                    onClick={() => {
                                                        setEditingQuiz(q);
                                                        setQuizQuestionText(q.question);
                                                        setOptionA(q.optionA);
                                                        setOptionB(q.optionB);
                                                        setOptionC(q.optionC);
                                                        setCorrectAnswer(q.correctAnswer);
                                                        setQuizExplanation(q.explanation || '');
                                                        setIsQuizModalOpen(true);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Edit Quiz"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteQuiz(q.id)}
                                                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Delete Quiz"
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab 7: Gamification Rules */}
            {activeTab === 'rewards_rules' && (
                <div className="bg-white border rounded-2xl p-6 shadow-2xs">
                    <form onSubmit={handleSaveRules} className="space-y-6">
                        <div className="border-b pb-3 flex justify-between items-center">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <Trophy className="text-amber-500 h-5 w-5" /> Gamification & Point Rules
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Configure point payouts for daily activities and adjust store item costs.</p>
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
                            >
                                <Save size={14} /> {saving ? 'Saving...' : 'Save Rules & Store'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Points configuration */}
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
                                    <Settings size={14} className="text-slate-500" /> Point Payout Structure
                                </h4>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Shift Attendance Payout (Check-in)
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="number"
                                            value={attendancePoints}
                                            onChange={(e) => setAttendancePoints(Number(e.target.value))}
                                            required
                                            min={0}
                                            className="w-24 px-3 py-2 text-xs border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                        />
                                        <span className="text-xs font-semibold text-slate-500">Points per day</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Given to guards when they check in as "Present".</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Daily Safety Quiz Payout (Correct Answer)
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="number"
                                            value={quizPoints}
                                            onChange={(e) => setQuizPoints(Number(e.target.value))}
                                            required
                                            min={0}
                                            className="w-24 px-3 py-2 text-xs border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                        />
                                        <span className="text-xs font-semibold text-slate-500">Points per day</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Given to guards when they answer the safety quiz correctly.</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        Daily Login/Visit Streak Payout
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="number"
                                            value={streakPoints}
                                            onChange={(e) => setStreakPoints(Number(e.target.value))}
                                            required
                                            min={0}
                                            className="w-24 px-3 py-2 text-xs border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                        />
                                        <span className="text-xs font-semibold text-slate-500">Points per day</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Given to guards when they visit the portal keeping their streak active.</p>
                                </div>
                            </div>

                            {/* Rewards Cost configuration */}
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
                                    <Gift size={14} className="text-slate-500" /> Reward Store Costs
                                </h4>
                                <div className="space-y-3">
                                    {rulesRewards.map((reward) => (
                                        <div key={reward.id} className="space-y-1 bg-white p-3 border rounded-xl shadow-2xs">
                                            <div className="flex justify-between items-center">
                                                <input
                                                    type="text"
                                                    value={reward.name}
                                                    onChange={(e) => updateRewardName(reward.id, e.target.value)}
                                                    className="text-xs font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none py-0.5 w-full"
                                                />
                                                <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap ml-2">{reward.id}</span>
                                            </div>
                                            <div className="flex items-center space-x-2 mt-1">
                                                <input
                                                    type="number"
                                                    value={reward.cost}
                                                    onChange={(e) => updateRewardCost(reward.id, Number(e.target.value))}
                                                    required
                                                    min={0}
                                                    className="w-20 px-2 py-1 text-xs border rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-bold"
                                                />
                                                <span className="text-[10px] font-bold text-slate-500">points cost</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'usage_billing' && isSuperAdmin && (
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <div>
                            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                                <Activity className="text-blue-600 animate-pulse" size={18} />
                                Usage & Billing Control Center
                            </h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                Real-Time GCP Stackdriver Metrics & Budget Limits
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={fetchMetrics}
                            disabled={loadingMetrics}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-50 border rounded-xl hover:bg-slate-100 transition-colors shadow-2xs"
                        >
                            <RefreshCw size={12} className={loadingMetrics ? "animate-spin" : ""} />
                            {loadingMetrics ? 'Refreshing...' : 'Refresh Metrics'}
                        </button>
                    </div>

                    {/* Alert Banners */}
                    {portalConfig?.manualEmergencyLock && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-bold animate-pulse">
                            <span className="text-xl">🚨</span>
                            <div>
                                <p className="uppercase tracking-wider text-[10px]">Active Status: Locked</p>
                                <p className="font-semibold text-red-650">The database is manually LOCKED. All guest and employee requests are blocked.</p>
                            </div>
                        </div>
                    )}
                    {!portalConfig?.manualEmergencyLock && (portalConfig?.manualReadOnly || portalConfig?.blockWritesOnLimit) && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-bold">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <p className="uppercase tracking-wider text-[10px]">Active Status: Read-Only</p>
                                <p className="font-semibold text-amber-650">The database is in READ-ONLY mode. Modifications are blocked.</p>
                            </div>
                        </div>
                    )}

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* CARD 1: Firestore Operations */}
                        <div className="border rounded-2xl p-5 space-y-4 shadow-2xs">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                                <Database size={14} className="text-blue-500" /> Firestore Operations
                            </h3>
                            <div className="space-y-3">
                                {/* Reads Progress */}
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                        <span>Reads (Daily)</span>
                                        <span>{metrics?.reads || 0} / {portalConfig?.dbReadCap || 45000}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div 
                                            className={`h-2 rounded-full transition-all ${
                                                ((metrics?.reads || 0) / (portalConfig?.dbReadCap || 45000)) >= 1 ? 'bg-red-500' :
                                                ((metrics?.reads || 0) / (portalConfig?.dbReadCap || 45000)) >= 0.8 ? 'bg-amber-500' : 'bg-blue-500'
                                            }`}
                                            style={{ width: `${Math.min(100, (((metrics?.reads || 0) / (portalConfig?.dbReadCap || 45000)) * 100))}%` }}
                                        ></div>
                                    </div>
                                </div>
                                {/* Writes Progress */}
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                        <span>Writes (Daily)</span>
                                        <span>{metrics?.writes || 0} / {portalConfig?.dbWriteCap || 18000}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div 
                                            className={`h-2 rounded-full transition-all ${
                                                ((metrics?.writes || 0) / (portalConfig?.dbWriteCap || 18000)) >= 1 ? 'bg-red-500' :
                                                ((metrics?.writes || 0) / (portalConfig?.dbWriteCap || 18000)) >= 0.8 ? 'bg-amber-500' : 'bg-green-500'
                                            }`}
                                            style={{ width: `${Math.min(100, (((metrics?.writes || 0) / (portalConfig?.dbWriteCap || 18000)) * 100))}%` }}
                                        ></div>
                                    </div>
                                </div>
                                {/* Deletes */}
                                <div className="flex justify-between text-xs font-semibold text-slate-500 pt-1">
                                    <span>Deletes (Daily):</span>
                                    <span className="font-bold text-slate-700">{metrics?.deletes || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* CARD 2: Storage & Egress */}
                        <div className="border rounded-2xl p-5 space-y-4 shadow-2xs">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                                <UploadCloud size={14} className="text-emerald-500" /> Cloud Storage
                            </h3>
                            <div className="space-y-3">
                                {/* Size Progress */}
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                        <span>Storage Space (Total)</span>
                                        <span>{((metrics?.storageBytes || 0) / (1024 * 1024)).toFixed(1)} MB / {portalConfig?.storageCap || 4800} MB</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div 
                                            className="h-2 rounded-full bg-emerald-500 transition-all"
                                            style={{ width: `${Math.min(100, ((((metrics?.storageBytes || 0) / (1024 * 1024)) / (portalConfig?.storageCap || 4800)) * 100))}%` }}
                                        ></div>
                                    </div>
                                </div>
                                {/* Uploads & Downloads */}
                                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-500 pt-1">
                                    <div>
                                        <span>Uploads (A):</span>
                                        <p className="font-extrabold text-slate-700 text-sm mt-0.5">{metrics?.storageUploads || 0}</p>
                                    </div>
                                    <div>
                                        <span>Downloads (B):</span>
                                        <p className="font-extrabold text-slate-700 text-sm mt-0.5">{metrics?.storageDownloads || 0}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between text-xs font-semibold text-slate-500 border-t pt-2">
                                    <span>Egress (Bandwidth):</span>
                                    <span className="font-bold text-slate-700">{((metrics?.storageEgress || 0) / (1024 * 1024)).toFixed(1)} MB</span>
                                </div>
                            </div>
                        </div>

                        {/* CARD 3: Functions & Runs */}
                        <div className="border rounded-2xl p-5 space-y-4 shadow-2xs">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                                <Activity size={14} className="text-purple-500" /> Cloud Run Functions
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                        <span>Invocations (Monthly)</span>
                                        <span>{metrics?.invocations || 0} / 2,000,000</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div 
                                            className="h-2 rounded-full bg-purple-500 transition-all"
                                            style={{ width: `${Math.min(100, (((metrics?.invocations || 0) / 2000000) * 100))}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="flex justify-between text-xs font-semibold text-slate-500 pt-1">
                                    <span>Compute Time (Est):</span>
                                    <span className="font-bold text-slate-700">{Math.round((metrics?.invocations || 0) * 0.15)} vCPU-seconds</span>
                                </div>
                            </div>
                        </div>

                        {/* CARD 4: Deploy & Registry */}
                        <div className="border rounded-2xl p-5 space-y-4 shadow-2xs">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                                <Settings size={14} className="text-slate-500" /> Container Builds
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-semibold text-slate-500">
                                    <span>Container Registry Size:</span>
                                    <span className="font-extrabold text-slate-700">{((metrics?.containerStorage || 0) / (1024 * 1024)).toFixed(0)} MB / 500 MB</span>
                                </div>
                                <div className="flex justify-between text-xs font-semibold text-slate-500 pt-1 border-t">
                                    <span>Build minutes today:</span>
                                    <span className="font-bold text-slate-700">{metrics?.buildMinutes || 0} mins</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Limits Configuration Control Form */}
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-6">
                        <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            <Sliders size={16} className="text-blue-500" /> Circuit Breaker & Safeguard Settings
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Firestore Read Cap (Daily)
                                </label>
                                <input
                                    type="number"
                                    value={portalConfig?.dbReadCap || 45000}
                                    onChange={(e) => updatePortalConfigField('dbReadCap', Number(e.target.value))}
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Firestore Write Cap (Daily)
                                </label>
                                <input
                                    type="number"
                                    value={portalConfig?.dbWriteCap || 18000}
                                    onChange={(e) => updatePortalConfigField('dbWriteCap', Number(e.target.value))}
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Storage Cap (MB Total)
                                </label>
                                <input
                                    type="number"
                                    value={portalConfig?.storageCap || 4800}
                                    onChange={(e) => updatePortalConfigField('storageCap', Number(e.target.value))}
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                />
                            </div>
                        </div>

                        {/* Action Checkboxes */}
                        <div className="space-y-3 pt-3 border-t">
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={portalConfig?.blockReadsOnLimit || false}
                                    onChange={(e) => updatePortalConfigField('blockReadsOnLimit', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs font-bold text-slate-650">Block All Reads (Shuts down portal) when limit is exceeded</span>
                            </label>
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={portalConfig?.blockWritesOnLimit || false}
                                    onChange={(e) => updatePortalConfigField('blockWritesOnLimit', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs font-bold text-slate-650">Block Database Writes (Make Read-Only) when limit is exceeded</span>
                            </label>
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={portalConfig?.blockUploadsOnLimit || false}
                                    onChange={(e) => updatePortalConfigField('blockUploadsOnLimit', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs font-bold text-slate-650">Block File Uploads when storage limit is exceeded</span>
                            </label>
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={portalConfig?.autoDeleteAbandonedSubmissions || false}
                                    onChange={(e) => updatePortalConfigField('autoDeleteAbandonedSubmissions', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs font-bold text-slate-650">Nightly Cleanup: Automatically purge abandoned submissions older than 30 days</span>
                            </label>
                        </div>

                        {/* Manual Overrides */}
                        <div className="pt-4 border-t flex flex-wrap gap-4">
                            <button
                                type="button"
                                onClick={() => updatePortalConfigField('manualEmergencyLock', !portalConfig?.manualEmergencyLock)}
                                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 ${
                                    portalConfig?.manualEmergencyLock 
                                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                                    : 'bg-red-650 hover:bg-red-700 text-white'
                                }`}
                            >
                                <Lock size={12} />
                                {portalConfig?.manualEmergencyLock ? 'Emergency UNLOCK Database' : 'Emergency LOCK Database'}
                            </button>
                            <button
                                type="button"
                                onClick={() => updatePortalConfigField('manualReadOnly', !portalConfig?.manualReadOnly)}
                                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                                    portalConfig?.manualReadOnly 
                                    ? 'bg-amber-600 border-amber-600 hover:bg-amber-700 text-white' 
                                    : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100'
                                }`}
                            >
                                <Sliders size={12} />
                                {portalConfig?.manualReadOnly ? 'Disable Read-Only Mode' : 'Enable Read-Only Mode'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Grievance Resolution Modal */}
            {isResolveModalOpen && selectedGrievance && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-sm font-extrabold text-slate-800">Resolve Grievance</h3>
                            <button
                                type="button"
                                onClick={() => setIsResolveModalOpen(false)}
                                className="text-slate-400 hover:text-slate-650 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs bg-slate-50 p-4 border rounded-2xl">
                            <div>
                                <span className="font-extrabold text-slate-700 block">Submitted By:</span>
                                <span className="text-slate-600 font-semibold">{selectedGrievance.userName} (ID: {selectedGrievance.userId})</span>
                            </div>
                            <div>
                                <span className="font-extrabold text-slate-700 block">Grievance Description:</span>
                                <p className="text-slate-600 leading-relaxed font-semibold">{selectedGrievance.text}</p>
                            </div>
                        </div>

                        <form onSubmit={handleResolveSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                                <select
                                    value={resolutionStatus}
                                    onChange={(e) => setResolutionStatus(e.target.value)}
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="Investigating">Investigating</option>
                                    <option value="Resolved">Resolved</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Admin Response Note</label>
                                <textarea
                                    value={adminResponseText}
                                    onChange={(e) => setAdminResponseText(e.target.value)}
                                    rows={4}
                                    required
                                    placeholder="Type response, action taken, or comments for the employee..."
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-650 font-semibold"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsResolveModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl border text-slate-600 text-xs font-bold hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all shadow-xs"
                                >
                                    {saving ? 'Saving...' : 'Update Grievance'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Quiz Creation/Edition Modal */}
            {isQuizModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-100 shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-sm font-extrabold text-slate-800">
                                {editingQuiz ? 'Edit Quiz Question' : 'Create Quiz Question'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsQuizModalOpen(false)}
                                className="text-slate-400 hover:text-slate-650 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveQuiz} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Question Text</label>
                                <textarea
                                    value={quizQuestionText}
                                    onChange={(e) => setQuizQuestionText(e.target.value)}
                                    rows={2}
                                    required
                                    placeholder="Enter the safety question..."
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option A</label>
                                    <input
                                        type="text"
                                        value={optionA}
                                        onChange={(e) => setOptionA(e.target.value)}
                                        required
                                        placeholder="Option A..."
                                        className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option B</label>
                                    <input
                                        type="text"
                                        value={optionB}
                                        onChange={(e) => setOptionB(e.target.value)}
                                        required
                                        placeholder="Option B..."
                                        className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option C</label>
                                    <input
                                        type="text"
                                        value={optionC}
                                        onChange={(e) => setOptionC(e.target.value)}
                                        required
                                        placeholder="Option C..."
                                        className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Correct Answer</label>
                                    <select
                                        value={correctAnswer}
                                        onChange={(e) => setCorrectAnswer(e.target.value as 'A' | 'B' | 'C')}
                                        className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                    >
                                        <option value="A">Option A</option>
                                        <option value="B">Option B</option>
                                        <option value="C">Option C</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Explanation Note</label>
                                <textarea
                                    value={quizExplanation}
                                    onChange={(e) => setQuizExplanation(e.target.value)}
                                    rows={2}
                                    required
                                    placeholder="Explain why this option is correct..."
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-650"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsQuizModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl border text-slate-600 text-xs font-bold hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all shadow-xs"
                                >
                                    {saving ? 'Saving...' : 'Save Quiz Question'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for creating/editing blog posts */}
            {isBlogModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <form onSubmit={handleSaveBlog} className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative space-y-4">
                        <button
                            type="button"
                            onClick={() => setIsBlogModalOpen(false)}
                            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
                        >
                            <X size={18} />
                        </button>

                        <h3 className="text-lg font-bold text-slate-800">
                            {editingPost ? 'Edit Blog Post' : 'Publish New Blog Post'}
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold mb-4">Provide details for the public article.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                                <select
                                    value={blogCategory}
                                    onChange={(e) => setBlogCategory(e.target.value)}
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="Guides">Guides</option>
                                    <option value="Safety & Security">Safety & Security</option>
                                    <option value="Company News">Company News</option>
                                    <option value="Industry Insights">Industry Insights</option>
                                    <option value="Career Development">Career Development</option>
                                    <option value="Technology">Technology</option>
                                    <option value="Compliance">Compliance</option>
                                    <option value="Corporate Safety">Corporate Safety</option>
                                    <option value="Training">Training</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Display Date (e.g. Month Day, Year)</label>
                                <input
                                    type="text"
                                    value={blogDate}
                                    onChange={(e) => setBlogDate(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Read Time Label (e.g. 5 min read)</label>
                                <input
                                    type="text"
                                    value={blogReadTime}
                                    onChange={(e) => setBlogReadTime(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cover Image Path or URL (Optional)</label>
                                <input
                                    type="text"
                                    value={blogImageUrl}
                                    onChange={(e) => setBlogImageUrl(e.target.value)}
                                    placeholder="e.g. /blog-assets/uan_activation.png or https://..."
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                />
                                {blogImageUrl && (
                                    <div className="flex items-center gap-2 mt-2 p-1.5 border border-slate-200 rounded-xl bg-slate-50">
                                        <div className="h-10 w-14 rounded-lg overflow-hidden border border-slate-200 bg-white flex-shrink-0">
                                            <img src={getFormattedImageUrl(blogImageUrl)} alt="Cover preview" className="w-full h-full object-cover" />
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-semibold truncate flex-1">{blogImageUrl}</span>
                                        <button
                                            type="button"
                                            onClick={() => setBlogImageUrl('')}
                                            className="px-2 py-1 text-[10px] font-bold text-red-600 hover:text-red-800"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Article Title</label>
                            <input
                                type="text"
                                value={blogTitle}
                                onChange={(e) => setBlogTitle(e.target.value)}
                                required
                                placeholder="Enter post heading..."
                                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Excerpt Summary (Shown on landing grid)</label>
                            <textarea
                                value={blogExcerpt}
                                onChange={(e) => setBlogExcerpt(e.target.value)}
                                required
                                rows={2}
                                placeholder="Short paragraph summarizing the content..."
                                className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600 font-semibold"
                            />
                        </div>

                        {/* Priority / Privacy Flags */}
                        <div className="flex flex-wrap items-center gap-6 py-2 px-1">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={blogIsPinned}
                                    onChange={(e) => setBlogIsPinned(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                />
                                <span>Pin to Top (Priority)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={blogIsPrivate}
                                    onChange={(e) => setBlogIsPrivate(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                />
                                <span>Employee-Only (Private Post)</span>
                            </label>
                        </div>

                        {/* Tabs Switcher for Write vs Preview */}
                        <div className="flex border-b border-slate-200 text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setBlogEditMode('write')}
                                className={`pb-2 px-4 border-b-2 transition-all ${
                                    blogEditMode === 'write' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Edit Content (HTML)
                            </button>
                            <button
                                type="button"
                                onClick={() => setBlogEditMode('preview')}
                                className={`pb-2 px-4 border-b-2 transition-all ${
                                    blogEditMode === 'preview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Live Preview
                            </button>
                        </div>

                        {blogEditMode === 'write' ? (
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Article HTML Content</label>
                                
                                {/* Quick HTML Insertion Toolbar */}
                                <div className="flex flex-wrap gap-1.5 bg-slate-100 p-2 rounded-t-xl border border-slate-200 border-b-0">
                                    <button 
                                        type="button" 
                                        onClick={() => wrapTextAtCursor('<p class="text-slate-650 mb-4">', '</p>')} 
                                        className="px-2 py-1 text-[9px] font-extrabold bg-white hover:bg-slate-50 border rounded-lg text-slate-700 shadow-2xs"
                                        title="Wrap text in a paragraph paragraph tag"
                                    >
                                        Paragraph
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => wrapTextAtCursor('<h3 class="font-bold text-lg text-slate-900 mt-5 mb-2">', '</h3>')} 
                                        className="px-2 py-1 text-[9px] font-extrabold bg-white hover:bg-slate-50 border rounded-lg text-slate-700 shadow-2xs"
                                        title="Wrap text in a heading tag"
                                    >
                                        Subheading
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => wrapTextAtCursor('<strong>', '</strong>')} 
                                        className="px-2 py-1 text-[9px] font-extrabold bg-white hover:bg-slate-50 border rounded-lg text-slate-700 shadow-2xs"
                                        title="Make text bold"
                                    >
                                        Bold
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => wrapTextAtCursor('<em>', '</em>')} 
                                        className="px-2 py-1 text-[9px] font-extrabold bg-white hover:bg-slate-50 border rounded-lg text-slate-700 shadow-2xs"
                                        title="Make text italic"
                                    >
                                        Italic
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => insertTextAtCursor('<ul class="list-disc pl-6 space-y-2 mb-4">\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>')} 
                                        className="px-2 py-1 text-[9px] font-extrabold bg-white hover:bg-slate-50 border rounded-lg text-slate-700 shadow-2xs"
                                        title="Insert bulleted list template"
                                    >
                                        Bullet List
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => insertTextAtCursor('<ol class="list-decimal pl-6 space-y-2 mb-4">\n  <li>First Item</li>\n  <li>Second Item</li>\n</ol>')} 
                                        className="px-2 py-1 text-[9px] font-extrabold bg-white hover:bg-slate-50 border rounded-lg text-slate-700 shadow-2xs"
                                        title="Insert numbered list template"
                                    >
                                        Numbered List
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => insertTextAtCursor('<div class="relative w-full aspect-video my-5 rounded-2xl overflow-hidden shadow-md">\n  <iframe class="absolute inset-0 w-full h-full" src="https://www.youtube.com/embed/VIDEO_ID" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>\n</div>')} 
                                        className="px-2 py-1 text-[9px] font-extrabold bg-white hover:bg-slate-50 border rounded-lg text-slate-700 shadow-2xs"
                                        title="Insert responsive YouTube Video iframe template"
                                    >
                                        YouTube Video
                                    </button>
                                </div>

                                <textarea
                                    id="blog-content-textarea"
                                    value={blogContent}
                                    onChange={(e) => setBlogContent(e.target.value)}
                                    required
                                    rows={10}
                                    placeholder="Type article content. Select text and click the buttons above to format..."
                                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-b-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-650"
                                />
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[400px] overflow-y-auto border border-slate-200 rounded-2xl p-6 bg-slate-50">
                                {blogImageUrl && (
                                    <div className="h-44 w-full rounded-xl overflow-hidden mb-4">
                                        <img src={getFormattedImageUrl(blogImageUrl)} alt="Preview cover" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <h1 className="text-xl font-bold text-slate-900 leading-tight">{blogTitle || 'Post Title'}</h1>
                                <div className="text-[10px] text-slate-400 font-semibold space-x-2">
                                    <span>{blogCategory}</span>
                                    <span>•</span>
                                    <span>{blogDate}</span>
                                    <span>•</span>
                                    <span>{blogReadTime}</span>
                                </div>
                                <hr />
                                <div 
                                    className="prose prose-slate prose-sm text-slate-650 max-w-none leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(blogContent) || '<p class="text-slate-400 italic">No content typed yet...</p>' }}
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-3 border-t">
                            <button
                                type="button"
                                onClick={() => setIsBlogModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl border text-slate-600 text-xs font-bold hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all shadow-xs"
                            >
                                {saving ? 'Saving...' : 'Publish Post'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

// Help helper icon component
const X: React.FC<{ size: number }> = ({ size }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

export default AdminWebsiteManager;
