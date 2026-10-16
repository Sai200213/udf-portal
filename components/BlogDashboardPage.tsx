import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../src/context/AuthContext';
import { 
    Flame, 
    HelpCircle, 
    Clock, 
    MessageSquareCode, 
    ClipboardCheck, 
    AlertCircle, 
    Sparkles, 
    Smile, 
    Award,
    Trophy,
    ShoppingBag,
    Gift,
    CheckCircle2
} from 'lucide-react';
import PublicHeader from './common/PublicHeader';
import PublicFooter from './common/PublicFooter';
import AdSenseUnit from './common/AdSenseUnit';
import AttendanceCalendar from './employee/AttendanceCalendar';
import { getUserStreak, updateOrCreateStreak, submitComplaint, createRewardRedemption, UserStreak } from '../src/services/engagementService';
import { db } from '../src/firebase/config';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';

const BlogDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const userId = user?.portalId || user?.id || '';
    const rawUserName = user?.name || 'Employee';
    const userName = rawUserName === 'N/A' ? (user?.employeeId || 'Employee') : rawUserName;

    // Streak & Points state
    const [streak, setStreak] = useState<UserStreak & { points?: number } | null>(null);
    const [points, setPoints] = useState(0);
    const [loadingStreak, setLoadingStreak] = useState(false);

    // Quiz state
    const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [quizAwarded, setQuizAwarded] = useState(false);

    // Complaint state
    const [complaintText, setComplaintText] = useState('');
    const [submittingComplaint, setSubmittingComplaint] = useState(false);
    const [complaintStatus, setComplaintStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Reward redemption state
    const [redemptionSuccess, setRedemptionSuccess] = useState<string | null>(null);

    // Dynamic point rules state
    const [gamificationRules, setGamificationRules] = useState({
        attendancePoints: 5,
        quizPoints: 10,
        rewards: [
            { id: 'cap', name: 'UDF Branded Security Cap', cost: 300 },
            { id: 'bottle', name: 'Stainless Steel Water Bottle', cost: 500 },
            { id: 'jacket', name: 'Premium Warm Winter Jacket', cost: 1200 }
        ]
    });

    // Dynamic Quiz Question state
    const [quizQuestion, setQuizQuestion] = useState({
        id: 'default',
        question: "When patrolling a site at night, what is the first action to take if a security seal is found broken on a server room door?",
        options: [
            { id: 'A', text: 'Enter immediately to inspect the room alone.' },
            { id: 'B', text: 'Do not enter, secure the perimeter, and notify the Supervisor immediately.' },
            { id: 'C', text: 'Leave it as is and check it on the next patrol round.' }
        ],
        correctAnswer: 'B',
        explanation: 'Always secure the door perimeter and contact the Supervisor immediately. Never enter a potentially breached server room alone for your own safety.'
    });

    useEffect(() => {
        document.title = "Employee Engagement Dashboard - Unique Delta Force";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', 'Daily employee engagement portal. Check streaks, mark attendance, answer safety quizzes, and redeem reward points.');
        }
        window.scrollTo(0, 0);

        if (userId) {
            loadStreakAndPoints();
            loadGamificationData();
        }
    }, [userId]);

    const loadGamificationData = async () => {
        try {
            // 1. Fetch rules
            const rulesRef = doc(db, 'settings', 'gamification_rules');
            const rulesSnap = await getDoc(rulesRef);
            if (rulesSnap.exists()) {
                const data = rulesSnap.data() as any;
                setGamificationRules({
                    attendancePoints: data.attendancePoints ?? 5,
                    quizPoints: data.quizPoints ?? 10,
                    rewards: data.rewards ?? gamificationRules.rewards
                });
            }

            // 2. Fetch custom quizzes
            const quizzesSnap = await getDocs(collection(db, 'safety_quizzes'));
            if (!quizzesSnap.empty) {
                const list = quizzesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
                // Pick a daily question based on the day of the month
                const dayIndex = new Date().getDate() % list.length;
                const activeQuiz = list[dayIndex];
                setQuizQuestion({
                    id: activeQuiz.id,
                    question: activeQuiz.question,
                    options: [
                        { id: 'A', text: activeQuiz.optionA },
                        { id: 'B', text: activeQuiz.optionB },
                        { id: 'C', text: activeQuiz.optionC }
                    ],
                    correctAnswer: activeQuiz.correctAnswer,
                    explanation: activeQuiz.explanation || 'Please prioritize site security and check supervisor commands.'
                });
            }
        } catch (err) {
            console.error("Failed to load gamification and quiz settings:", err);
        }
    };

    const loadStreakAndPoints = async () => {
        setLoadingStreak(true);
        try {
            const userStreak = await updateOrCreateStreak(userId, userName) as any;
            if (userStreak) {
                setStreak(userStreak);
                setPoints(userStreak.points || 0);
            }
        } catch (err) {
            console.error("Failed to load/update streak and points:", err);
        } finally {
            setLoadingStreak(false);
        }
    };

    // Calculate payday countdown
    const daysUntilPayday = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        let payday = new Date(year, month, 7);
        if (today.getDate() > 7) {
            payday = new Date(year, month + 1, 7);
        }
        const diffTime = payday.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }, []);

    // Handle safety quiz submission
    const handleQuizSubmit = async () => {
        if (!quizAnswer) return;
        setQuizSubmitted(true);

        const isCorrect = quizAnswer === quizQuestion.correctAnswer;
        if (isCorrect && userId && streak) {
            const addedPoints = gamificationRules.quizPoints;
            const newPoints = points + addedPoints;
            setPoints(newPoints);
            setQuizAwarded(true);

            try {
                const docRef = doc(db, 'user_engagement', userId);
                await setDoc(docRef, {
                    ...streak,
                    points: newPoints
                }, { merge: true });
            } catch (err) {
                console.error("Failed to update quiz points in Firestore:", err);
            }
        }
    };

    // Handle complaint submission
    const handleComplaintSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!complaintText.trim()) return;

        setSubmittingComplaint(true);
        setComplaintStatus('idle');
        try {
            const success = await submitComplaint(userId, userName, complaintText);
            if (success) {
                setComplaintStatus('success');
                setComplaintText('');
                setTimeout(() => setComplaintStatus('idle'), 4000);
            } else {
                setComplaintStatus('error');
            }
        } catch (err) {
            console.error("Failed to submit grievance:", err);
            setComplaintStatus('error');
        } finally {
            setSubmittingComplaint(false);
        }
    };

    // Handle reward claiming
    const claimReward = async (item: string, cost: number) => {
        if (points < cost) {
            alert("Insufficient points for this reward.");
            return;
        }

        if (!userId) {
            alert("Please log in to claim rewards.");
            return;
        }

        try {
            const success = await createRewardRedemption(userId, userName, item, cost);
            if (success) {
                setPoints(prev => Math.max(0, prev - cost));
                setRedemptionSuccess(item);
                setTimeout(() => setRedemptionSuccess(null), 5000);
            } else {
                alert("Reward redemption failed or insufficient points balance.");
            }
        } catch (err) {
            console.error("Failed to update points after redemption:", err);
            alert("An error occurred while claiming reward. Please try again.");
        }
    };

    const leaderboard = [
        { name: userName || 'You', site: "Active Station", points: points, isCurrentUser: true }
    ];

    const rewardsList = useMemo(() => {
        const icons = [
            <Gift className="h-5 w-5 text-orange-500" />,
            <ShoppingBag className="h-5 w-5 text-blue-500" />,
            <Sparkles className="h-5 w-5 text-yellow-500" />
        ];
        return gamificationRules.rewards.map((r, idx) => ({
            name: r.name,
            cost: r.cost,
            icon: icons[idx % icons.length]
        }));
    }, [gamificationRules]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <PublicHeader />

            {/* Main Content Hub */}
            <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                
                {/* Ad Space (Top) */}
                <div className="mb-8">
                    <AdSenseUnit slot="7777777777" format="horizontal" />
                </div>

                {!user || user.type !== 'Employee' ? (
                    /* Unauthorized view - Call to log in */
                    <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xs">
                        <div className="bg-blue-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 text-blue-600">
                            <Trophy size={32} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-3">Employee Engagement Hub</h2>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
                            Welcome to the Unique Delta Force rewards and engagement portal. Log in as an employee to track your daily attendance, earn safety quiz points, check streaks, and redeem UDF gear rewards!
                        </p>
                        <button
                            onClick={() => navigate('/login?redirect=/dashboard')}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-xl text-sm transition-all shadow-md hover:shadow-blue-500/20"
                        >
                            Log In as Employee
                        </button>
                    </div>
                ) : (
                    /* Authorized view */
                    <div className="space-y-8">
                        {/* Welcome greetings banner */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
                            <div className="absolute right-0 top-0 transform translate-x-12 -translate-y-6 opacity-10">
                                <Sparkles size={250} />
                            </div>
                            <div className="relative z-10 max-w-xl">
                                <h2 className="text-2xl sm:text-3xl font-black mb-2 flex items-center gap-2">
                                    Welcome Back, {userName}! <Smile className="text-yellow-300" />
                                </h2>
                                <p className="text-blue-100 text-xs sm:text-sm leading-relaxed font-semibold">
                                    Earn compliance badges and points by checking in daily, marking your shifts, and maintaining top safety scores.
                                </p>
                            </div>
                        </div>

                        {/* Top stats block */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {/* Streak */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex items-center space-x-4">
                                <div className="bg-orange-50 border border-orange-100 p-3 rounded-2xl text-orange-500">
                                    <Flame size={24} className="animate-pulse" />
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Daily Visit Streak</span>
                                    <span className="text-2xl font-black text-slate-900">{streak?.streakCount || 1} Days Active</span>
                                </div>
                            </div>

                            {/* Accumulated Points */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex items-center space-x-4">
                                <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-2xl text-yellow-600">
                                    <Trophy size={24} />
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Available Points</span>
                                    <span className="text-2xl font-black text-slate-900">{points} Points</span>
                                </div>
                            </div>

                            {/* Payday Countdown */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex items-center space-x-4">
                                <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-blue-600">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Salary Release Countdown</span>
                                    <span className="text-2xl font-black text-slate-900">{daysUntilPayday} Days Left</span>
                                </div>
                            </div>
                        </div>

                        {/* Main Grid split */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            
                            {/* Left Side: Game elements */}
                            <div className="lg:col-span-7 space-y-8">
                                
                                {/* Safety Quiz */}
                                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600 border border-blue-100">
                                            <HelpCircle className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800">Daily Safety Quiz</h3>
                                            <p className="text-[10px] text-slate-400 font-medium">Test your knowledge to win +10 points daily.</p>
                                        </div>
                                    </div>

                                    <p className="text-xs font-bold text-slate-700 mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100 leading-relaxed">
                                        Q: {quizQuestion.question}
                                    </p>

                                    <div className="space-y-2">
                                        {quizQuestion.options.map(opt => {
                                            const isSelected = quizAnswer === opt.id;
                                            const isCorrect = opt.id === quizQuestion.correctAnswer;
                                            let btnStyle = "bg-white border-slate-200 hover:bg-slate-50 text-slate-700";
                                            if (quizSubmitted) {
                                                if (isCorrect) {
                                                    btnStyle = "bg-emerald-50 border-emerald-400 text-emerald-800 font-bold";
                                                } else if (isSelected) {
                                                    btnStyle = "bg-red-50 border-red-400 text-red-800";
                                                } else {
                                                    btnStyle = "bg-white border-slate-100 text-slate-300 opacity-60";
                                                }
                                            } else if (isSelected) {
                                                btnStyle = "bg-blue-50 border-blue-400 text-blue-800 font-bold";
                                            }
                                            
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    disabled={quizSubmitted}
                                                    onClick={() => setQuizAnswer(opt.id)}
                                                    className={`w-full text-left p-3.5 text-xs rounded-xl border transition-all duration-150 flex items-start ${btnStyle}`}
                                                >
                                                    <span className="font-extrabold mr-1.5">{opt.id}.</span>
                                                    <span>{opt.text}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4">
                                        {quizSubmitted ? (
                                            <div className="text-[10px] font-bold p-3.5 rounded-xl bg-slate-50 text-slate-700 leading-relaxed border border-slate-150">
                                                {quizAnswer === quizQuestion.correctAnswer ? (
                                                    <span className="text-emerald-700">✓ Correct! (+{gamificationRules.quizPoints} Points Added)</span>
                                                ) : (
                                                    <span className="text-red-700">✗ Incorrect.</span>
                                                )}{' '}
                                                {quizQuestion.explanation}
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={!quizAnswer}
                                                onClick={handleQuizSubmit}
                                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-xs"
                                            >
                                                Submit Answer
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Leaderboard & Points list */}
                                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="bg-yellow-50 p-2.5 rounded-xl text-yellow-600 border border-yellow-100">
                                            <Award className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800">UDF India Leaderboard</h3>
                                            <p className="text-[10px] text-slate-400 font-medium">Rankings based on attendance, streaks, and quiz safety records.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        {leaderboard.map((player, idx) => (
                                            <div 
                                                key={idx} 
                                                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all
                                                    ${player.isCurrentUser 
                                                        ? 'bg-blue-50/50 border-blue-200 text-blue-900 font-extrabold shadow-2xs' 
                                                        : 'bg-slate-50/50 border-slate-150 text-slate-700'
                                                    }`}
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black
                                                        ${idx === 0 ? 'bg-yellow-400 text-slate-900' : ''}
                                                        ${idx === 1 ? 'bg-slate-300 text-slate-900' : ''}
                                                        ${idx === 2 ? 'bg-orange-300 text-slate-900' : ''}
                                                        ${idx > 2 ? 'bg-slate-100 text-slate-500' : ''}
                                                    `}>
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <span className="text-xs font-bold block">{player.name} {player.isCurrentUser && "(You)"}</span>
                                                        <span className="text-[9px] text-slate-400 uppercase font-semibold">{player.site}</span>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-black">{player.points} pts</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Reward Store */}
                                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="bg-green-50 p-2.5 rounded-xl text-green-600 border border-green-100">
                                            <ShoppingBag className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800">UDF Gear Store</h3>
                                            <p className="text-[10px] text-slate-400 font-medium">Redeem your hard-earned points for company merchandise.</p>
                                        </div>
                                    </div>

                                    {redemptionSuccess && (
                                        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-[10px] font-bold flex items-center gap-2">
                                            <CheckCircle2 size={14} />
                                            <span>Redemption requested for "{redemptionSuccess}"! Confirm with your site manager.</span>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {rewardsList.map((item, idx) => {
                                            const canClaim = points >= item.cost;
                                            return (
                                                <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between items-center text-center">
                                                    <div className="bg-white p-3 rounded-full border border-slate-100 mb-3 shadow-2xs">
                                                        {item.icon}
                                                    </div>
                                                    <h4 className="text-xs font-bold text-slate-900 leading-tight mb-1">{item.name}</h4>
                                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 mb-4">{item.cost} pts</span>
                                                    <button
                                                        onClick={() => claimReward(item.name, item.cost)}
                                                        disabled={!canClaim}
                                                        className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-[10px] transition-all"
                                                    >
                                                        Redeem
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Complaint box */}
                                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="bg-red-50 p-2.5 rounded-xl text-red-500 border border-red-100">
                                            <MessageSquareCode className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800">Confidential Grievance Desk</h3>
                                            <p className="text-[10px] text-slate-400 font-medium">Direct secure submission channel to HR management.</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleComplaintSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                                Grievance Details
                                            </label>
                                            <textarea
                                                required
                                                value={complaintText}
                                                onChange={(e) => setComplaintText(e.target.value)}
                                                rows={4}
                                                placeholder="Provide detailed description of the issue. Submissions are kept strictly confidential for HR investigation..."
                                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        {complaintStatus === 'success' && (
                                            <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-xl p-3 text-[10px] font-bold flex items-center space-x-2">
                                                <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                                                <span>Grievance ticket registered. HR Management will audit this.</span>
                                            </div>
                                        )}

                                        {complaintStatus === 'error' && (
                                            <div className="bg-red-50 border border-red-250 text-red-800 rounded-xl p-3 text-[10px] font-bold flex items-center space-x-2">
                                                <AlertCircle className="h-4 w-4" />
                                                <span>Grievance registry failed. Please retry.</span>
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={submittingComplaint || !complaintText.trim()}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-50 shadow-sm"
                                        >
                                            {submittingComplaint ? 'Submitting...' : 'Register Grievance Ticket'}
                                        </button>
                                    </form>
                                </div>

                            </div>

                            {/* Right Side: Shift Calendar marker */}
                            <div className="lg:col-span-5">
                                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs sticky top-24">
                                    <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-3 flex items-center gap-1.5">
                                        <Trophy size={16} className="text-blue-600" />
                                        Shift Check-in Calendar
                                    </h3>
                                    <AttendanceCalendar userId={userId} userName={userName} />
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {/* Ad Space (Bottom) */}
                <div className="mt-8">
                    <AdSenseUnit slot="8888888888" format="horizontal" />
                </div>
            </div>

            <PublicFooter />
        </div>
    );
};

export default BlogDashboardPage;
