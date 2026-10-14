import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Vacancy, UserType } from '../types';
import { 
    ExternalLink, 
    MapPin, 
    Briefcase, 
    Users, 
    ArrowRight, 
    ChevronDown, 
    ChevronUp, 
    ChevronRight,
    BookOpen, 
    X,
    Clock,
    Search,
    Lock
} from 'lucide-react';
import AdSenseUnit from './common/AdSenseUnit';
import PublicHeader from './common/PublicHeader';
import { sanitizeHtml } from '../src/utils/sanitizeHtml';
import PublicFooter from './common/PublicFooter';
import SEOHead from '../src/components/common/SEOHead';
import { useAuth } from '../src/context/AuthContext';

import { getBlogPosts, BlogPost } from '../src/services/blogService';
import { getWebsiteConfig } from '../src/services/websiteService';

const getFormattedImageUrl = (url?: string) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
        return trimmed;
    }
    return `/${trimmed}`;
};

const BlogsPage: React.FC = () => {
    const navigate = useNavigate();
    const { postId } = useParams<{ postId: string }>();
    const { user } = useAuth();
    const isEmployee = user && user.type === UserType.EMPLOYEE;

    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [vacancies, setVacancies] = useState<Vacancy[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRole, setExpandedRole] = useState<string | null>(null);
    const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
    const [isAccessLocked, setIsAccessLocked] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    useEffect(() => {
        document.title = "Security & Compliance Blogs - Unique Delta Force";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', 'Read about EPF/ESIC compliance, safety guidelines, and company announcements from the Unique Delta Force security team.');
        }

        window.scrollTo(0, 0);
        loadInitialData();
    }, []);

    const generateSlug = (title: string) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    };

    // Check parameters to open specific blog post on load
    useEffect(() => {
        if (posts.length > 0) {
            if (postId) {
                const found = posts.find(p => p.id === postId || generateSlug(p.title) === postId);
                if (found) {
                    if (found.isPrivate && !isEmployee) {
                        setIsAccessLocked(true);
                        setSelectedPost(found);
                        document.title = "Access Locked - UDF Security Blogs";
                    } else {
                        setIsAccessLocked(false);
                        setSelectedPost(found);
                        document.title = `${found.title} - UDF Security Blogs`;
                    }
                } else {
                    setSelectedPost(null);
                    setIsAccessLocked(false);
                }
            } else {
                setSelectedPost(null);
                setIsAccessLocked(false);
                document.title = "Security & Compliance Blogs - Unique Delta Force";
            }
        }
    }, [posts, postId, isEmployee]);

    // After article mounts on screen, smoothly scroll to top after a short 150ms delay
    useEffect(() => {
        if (selectedPost) {
            const timer = setTimeout(() => {
                window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [selectedPost, postId]);

    // Handle closing the blog reader and navigating back
    const handleClosePost = () => {
        setSelectedPost(null);
        navigate('/blogs');
    };



    const loadInitialData = async () => {
        try {
            const [postsData, vacancyData] = await Promise.all([
                getBlogPosts(),
                import('../src/services/vacancyService').then(m => m.getOpenVacancies())
            ]);
            setPosts(postsData);
            setVacancies(vacancyData);
        } catch (err) {
            console.error("Failed to load blogs data", err);
        } finally {
            setLoading(false);
        }
    };

    const groupedVacancies = React.useMemo(() => {
        const groups: { [key: string]: Vacancy[] } = {};
        vacancies.forEach(v => {
            if (!groups[v.title]) groups[v.title] = [];
            groups[v.title].push(v);
        });
        return groups;
    }, [vacancies]);

    const visiblePosts = React.useMemo(() => {
        return posts.filter(post => !post.isPrivate || isEmployee);
    }, [posts, isEmployee]);

    const filteredPosts = React.useMemo(() => {
        const filtered = visiblePosts.filter(post => {
            const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
            const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  post.content.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });

        // Pinned posts sort to the top
        return filtered.sort((a, b) => {
            const aPinned = a.isPinned ? 1 : 0;
            const bPinned = b.isPinned ? 1 : 0;
            return bPinned - aPinned;
        });
    }, [visiblePosts, searchQuery, selectedCategory]);

    const toggleRole = (role: string) => {
        setExpandedRole(expandedRole === role ? null : role);
    };

    const handleApply = (vacancy: Vacancy) => {
        navigate(`/join?siteId=${vacancy.siteId}&role=${encodeURIComponent(vacancy.title)}`);
    };

    const categories = React.useMemo(() => {
        const cats = new Set(visiblePosts.map(p => p.category));
        return ['All', ...Array.from(cats)];
    }, [visiblePosts]);

    const relatedPosts = React.useMemo(() => {
        if (!selectedPost) return [];
        const sameCategory = visiblePosts.filter(p => p.id !== selectedPost.id && p.category === selectedPost.category);
        if (sameCategory.length < 3) {
            const otherCategory = visiblePosts.filter(p => p.id !== selectedPost.id && p.category !== selectedPost.category);
            return [...sameCategory, ...otherCategory].slice(0, 3);
        }
        return sameCategory.slice(0, 3);
    }, [visiblePosts, selectedPost]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <SEOHead
                title={selectedPost ? `${selectedPost.title} | Unique Delta Force Security` : "Security Industry Insights & Guides | UDF Online Blog"}
                description={selectedPost ? (selectedPost.excerpt || selectedPost.title) : "Read security industry management guides, EPF/ESI compliance rules, and workplace safety protocols on UDF Online."}
                canonicalUrl={selectedPost ? `https://udfonline.in/blogs/${selectedPost.slug || generateSlug(selectedPost.title)}` : "https://udfonline.in/blogs"}
                ogImage={selectedPost?.coverImage ? getFormattedImageUrl(selectedPost.coverImage) : undefined}
            />
            <PublicHeader />
            <main className="flex-1">

            {selectedPost ? (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        {/* Main Article Content Column */}
                        <article className="lg:col-span-8 space-y-6">
                            {/* Back Button */}
                            <button
                                onClick={handleClosePost}
                                className="flex items-center text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors bg-white border border-slate-200 hover:border-slate-300 px-4 py-2 rounded-xl shadow-2xs"
                            >
                                <span className="mr-1">&larr;</span> Back to Articles
                            </button>

                            {/* Metadata Header */}
                            <header className="border-b border-slate-200 pb-4">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100/60 px-2.5 py-1 rounded-md">
                                        {selectedPost.category}
                                    </span>
                                    <span className="text-xs text-slate-500 font-semibold">{selectedPost.date}</span>
                                    <span className="text-xs text-slate-400 font-semibold">&bull;</span>
                                    <span className="text-xs text-slate-500 font-semibold flex items-center">
                                        <Clock size={12} className="mr-1" /> {selectedPost.readTime}
                                    </span>
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">
                                    {selectedPost.title}
                                </h1>
                            </header>

                            {isAccessLocked ? (
                                <div className="max-w-xl mx-auto text-center py-16 px-4 bg-white border border-slate-200 rounded-3xl shadow-3xs my-6">
                                    <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 border border-blue-100">
                                        <Lock className="h-6 w-6 text-blue-600 animate-pulse" />
                                    </div>
                                    <h2 className="text-xl font-extrabold text-slate-900 mb-2">Employee-Only Access</h2>
                                    <p className="text-xs text-slate-500 mb-6 leading-relaxed max-w-sm mx-auto">
                                        This compliance guide contains internal security circulars and private protocols intended only for Unique Delta Force personnel.
                                    </p>
                                    <button
                                        onClick={() => navigate('/login')}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 px-8 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 mx-auto"
                                    >
                                        <Lock size={12} /> Log In as Employee
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Feature Image */}
                                    {selectedPost.imageUrl && (
                                        <div className="h-64 sm:h-96 w-full rounded-3xl overflow-hidden shadow-xs bg-slate-50 mb-6">
                                            <img 
                                                src={getFormattedImageUrl(selectedPost.imageUrl)} 
                                                alt={selectedPost.title} 
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}

                                    {/* Content Body */}
                                    <div 
                                        className="prose prose-slate prose-sm sm:prose-base max-w-none text-slate-700 leading-relaxed font-normal bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-3xs"
                                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedPost.content) }}
                                    />
                                </>
                            )}

                            {/* Bottom Back Button Action */}
                            <div className="pt-4 flex justify-start">
                                <button
                                    onClick={handleClosePost}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl text-xs transition-all shadow-sm flex items-center"
                                >
                                    <span className="mr-1">&larr;</span> Back to Articles
                                </button>
                            </div>
                        </article>

                        {/* Sidebar Column */}
                        <aside className="lg:col-span-4 lg:sticky lg:top-8 space-y-6 w-full">
                            {/* Ad Slot */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-3xs">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-2 text-center">
                                    Advertisement
                                </span>
                                <AdSenseUnit slot="3333333333" format="rectangle" />
                            </div>

                            {/* Related Articles Widget */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-3xs">
                                <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center">
                                    <BookOpen size={16} className="mr-2 text-blue-600" /> Related Articles
                                </h3>
                                <div className="space-y-4">
                                {relatedPosts.map(p => (
                                    <a 
                                        key={p.id}
                                        href={`/blogs/${generateSlug(p.title)}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setSelectedPost(p);
                                            navigate(`/blogs/${generateSlug(p.title)}`);
                                            window.scrollTo(0, 0);
                                        }}
                                        className="group block border-b border-slate-50 last:border-0 pb-3 last:pb-0"
                                    >
                                        <div className="flex gap-3">
                                            {p.imageUrl && (
                                                <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                                                    <img src={getFormattedImageUrl(p.imageUrl)} alt={p.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-[9px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                                                    {p.category}
                                                </span>
                                                <h4 className="text-xs font-bold text-slate-800 leading-snug group-hover:text-blue-600 transition-colors mt-1 line-clamp-2">
                                                    {p.title}
                                                </h4>
                                            </div>
                                        </div>
                                    </a>
                                ))}
                                </div>
                            </div>

                            {/* Sidebar Bottom Ad Slot */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-3xs">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-2 text-center">
                                    Advertisement
                                </span>
                                <AdSenseUnit slot="4444444444" format="rectangle" />
                            </div>
                        </aside>

                    </div>
                </div>
            ) : (
                <>
                {/* Banner Section */}
                <div className="bg-slate-900 py-16 text-white text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-slate-900 opacity-90"></div>
                    <div className="relative max-w-4xl mx-auto px-4">
                        <span className="text-xs uppercase font-extrabold text-blue-400 tracking-widest bg-blue-500/10 px-3.5 py-1.5 rounded-full border border-blue-400/20">
                            Knowledge & News Hub
                        </span>
                        <h1 className="text-3xl md:text-4xl font-extrabold mt-4 mb-2 tracking-tight">
                            Security Insights & Compliance Guides
                        </h1>
                        <p className="text-slate-300 text-sm max-w-xl mx-auto">
                            Learn about PF/ESI benefits, guarding guidelines, and official corporate updates.
                        </p>
                    </div>
                </div>

                {/* Top Ad banner */}
                <div className="my-8 max-w-6xl mx-auto px-4 w-full">
                    <AdSenseUnit slot="1111111111" format="horizontal" />
                </div>

                {/* Main Content split layout */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        {/* Full Width Column: Blog list */}
                        <div className="lg:col-span-12 space-y-8">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Latest Security Guides</h2>
                                    <p className="text-xs text-slate-500 mt-1 font-semibold">EPF/ESI compliance tips and site protocols.</p>
                                </div>
                                
                                {/* Actions wrapper */}
                                <div className="flex flex-wrap items-center gap-3">
                                    {/* Search bar */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search articles..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-9 pr-4 py-2 w-full sm:w-60 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Category filter tabs */}
                            <div className="flex overflow-x-auto pb-1 gap-2 no-scrollbar">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                                            selectedCategory === cat
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* Posts listing */}
                            {filteredPosts.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                                    <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500 text-sm font-semibold">No articles found matching search</p>
                                    <p className="text-slate-400 text-xs mt-1">Try updating your filters or search query.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {filteredPosts.map(post => (
                                        <a
                                            key={post.id}
                                            href={`/blogs/${generateSlug(post.title)}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setSelectedPost(post);
                                                navigate(`/blogs/${generateSlug(post.title)}`);
                                            }}
                                            className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-slate-300 transition-all duration-300 cursor-pointer flex flex-col justify-between block no-underline text-inherit"
                                        >
                                            <div>
                                                {post.imageUrl && (
                                                    <div className="h-48 w-full overflow-hidden relative">
                                                        <img 
                                                            src={getFormattedImageUrl(post.imageUrl)} 
                                                            alt={post.title} 
                                                            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                                                            loading="lazy"
                                                        />
                                                        <div className="absolute top-4 left-4">
                                                            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-md shadow-sm">
                                                                {post.category}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="p-6">
                                                    {!post.imageUrl && (
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-md">
                                                                {post.category}
                                                            </span>
                                                            <span className="text-xs text-slate-600 font-semibold">{post.date}</span>
                                                        </div>
                                                    )}
                                                    {post.imageUrl && (
                                                        <div className="mb-2">
                                                            <span className="text-xs text-slate-600 font-semibold">{post.date}</span>
                                                        </div>
                                                    )}
                                                    <h3 className="text-base font-bold text-slate-900 line-clamp-2 mb-2 leading-snug">
                                                        {post.title}
                                                    </h3>
                                                    <p className="text-slate-500 text-xs leading-relaxed line-clamp-3 mb-2">
                                                        {post.excerpt}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mx-6 pb-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-bold">
                                                <span className="flex items-center"><Clock size={12} className="mr-1" /> {post.readTime}</span>
                                                <span className="text-blue-600 flex items-center hover:underline">Read Article <ArrowRight size={12} className="ml-1" /></span>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Ad Unit */}
                <div className="my-8 max-w-6xl mx-auto px-4 w-full">
                    <AdSenseUnit slot="7777777777" format="horizontal" />
                </div>
                </>
            )}
            </main>

            <PublicFooter />
        </div>
    );
};

export default BlogsPage;
