import React, { useEffect, useState, useMemo } from 'react';
import { User, SubmittedFormData } from '../../types';
import { Flame, HelpCircle, Clock, MessageSquareCode, ClipboardCheck, AlertCircle, Sparkles, Smile, ShieldAlert } from 'lucide-react';
import { getUserStreak, updateOrCreateStreak, submitComplaint, UserStreak } from '../../src/services/engagementService';
import { db } from '../../src/firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import AttendanceCalendar from './AttendanceCalendar';

interface EmployeeEngagementHubProps {
    authUser: User | null;
    employeeData: SubmittedFormData | null;
}

const EmployeeEngagementHub: React.FC<EmployeeEngagementHubProps> = ({ authUser, employeeData }) => {
    const userId = authUser?.portalId || authUser?.id || '';
    const userName = authUser?.name || employeeData?.applicantName || 'Employee';

    // Streak state
    const [streak, setStreak] = useState<UserStreak | null>(null);
    
    // Quiz state
    const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
    
    // Complaint state
    const [complaintText, setComplaintText] = useState('');
    const [submittingComplaint, setSubmittingComplaint] = useState(false);
    const [complaintStatus, setComplaintStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        loadQuizzes();
    }, []);

    const loadQuizzes = async () => {
        try {
            const snap = await getDocs(query(collection(db, 'safety_quizzes'), orderBy('createdAt', 'desc')));
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setQuizzes(list);
            if (list.length > 0) {
                // Select a quiz deterministically based on today's date
                const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % list.length;
                setActiveQuiz(list[dayIndex]);
            }
        } catch (err) {
            console.error("Failed to load safety quizzes:", err);
        }
    };

    useEffect(() => {
        if (userId) {
            loadStreak();
        }
    }, [userId]);

    const loadStreak = async () => {
        try {
            // Fetch streak
            const userStreak = await getUserStreak(userId);
            if (userStreak) {
                setStreak(userStreak);
            } else {
                // Initialize streak on first visit
                const newStreak = await updateOrCreateStreak(userId, userName);
                setStreak(newStreak);
            }
        } catch (err) {
            console.error("Failed to load user streak:", err);
        }
    };

    // Payday Countdown Calculator
    const daysUntilPayday = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        // Payday is the 7th of every month
        let payday = new Date(year, month, 7);
        if (today.getDate() > 7) {
            payday = new Date(year, month + 1, 7);
        }
        const diffTime = payday.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }, []);

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

    return (
        <div className="space-y-6 font-sans">
            {/* Header Greetings Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 transform translate-x-12 -translate-y-6 opacity-10">
                    <Sparkles size={250} />
                </div>
                <div className="relative z-10 max-w-xl">
                    <h2 className="text-2xl sm:text-3xl font-black mb-2 flex items-center gap-2">
                        Welcome Back, {userName}! <Smile className="text-yellow-300" />
                    </h2>
                    <p className="text-blue-100 text-xs sm:text-sm leading-relaxed font-semibold">
                        This is your central Engagement Dashboard. Mark your shift attendance, check salary release countdowns, verify site compliance, or submit confidential feedback.
                    </p>
                </div>
            </div>

            {/* Split layout: left column widgets, right column calendar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Columns: Engagement Widgets */}
                <div className="lg:col-span-6 space-y-6">
                    
                    {/* Row 1: Streak and Payday Countdowns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        
                        {/* Streak Widget */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="bg-orange-100 p-2.5 rounded-xl text-orange-600">
                                    <Flame className="h-6 w-6 animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Visit Streak</h3>
                                    <p className="text-[10px] text-slate-400 font-medium">Daily portal engagement.</p>
                                </div>
                            </div>
                            
                            <div className="flex items-baseline space-x-1 bg-slate-50 border border-slate-100 rounded-xl p-3.5 shadow-inner">
                                <span className="text-3xl font-black text-orange-600">
                                    {streak ? streak.streakCount : 1}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">days active</span>
                            </div>
                        </div>

                        {/* Payday Countdowns */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
                                    <Clock className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Salary Countdown</h3>
                                    <p className="text-[10px] text-slate-400 font-medium">Salary credit (7th monthly).</p>
                                </div>
                            </div>
                            
                            <div className="flex items-baseline space-x-1 bg-slate-50 border border-slate-100 rounded-xl p-3.5 shadow-inner">
                                <span className="text-3xl font-black text-blue-600">
                                    {daysUntilPayday}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">days remaining</span>
                            </div>
                        </div>

                    </div>

                    {/* Quiz Widget */}
                    {(() => {
                        const currentQuiz = activeQuiz || {
                            question: 'When patrolling a site at night, what is the first action to take if a security seal is found broken on a server room door?',
                            optionA: 'Enter immediately to inspect the room alone.',
                            optionB: 'Do not enter, secure the perimeter, and notify the Supervisor immediately.',
                            optionC: 'Leave it as is and check it on the next patrol round.',
                            correctAnswer: 'B',
                            explanation: 'Always secure the door perimeter and contact the Supervisor immediately. Never enter a potentially breached server room alone for your own safety.'
                        };

                        const quizOptions = [
                            { id: 'A', text: currentQuiz.optionA },
                            { id: 'B', text: currentQuiz.optionB },
                            { id: 'C', text: currentQuiz.optionC },
                        ];

                        return (
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
                                        <HelpCircle className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800">Daily Safety Quiz</h3>
                                        <p className="text-[10px] text-slate-400 font-medium">Verify your incident management knowledge.</p>
                                    </div>
                                </div>
                                
                                <p className="text-xs font-bold text-slate-700 mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100 leading-relaxed">
                                    Q: {currentQuiz.question}
                                </p>
                                
                                <div className="space-y-2">
                                    {quizOptions.map(opt => {
                                        const isSelected = quizAnswer === opt.id;
                                        const isCorrect = opt.id === currentQuiz.correctAnswer;
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
                                                className={`w-full text-left p-3 text-xs rounded-xl border transition-all duration-150 flex items-start ${btnStyle}`}
                                            >
                                                <span className="font-extrabold mr-1.5">{opt.id}.</span>
                                                <span>{opt.text}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                <div className="mt-4">
                                    {quizSubmitted ? (
                                        <div className="text-[10px] font-bold p-3 rounded-xl bg-slate-50 text-slate-700 leading-relaxed border border-slate-150">
                                            {quizAnswer === currentQuiz.correctAnswer ? (
                                                <span className="text-emerald-700">✓ Correct!</span>
                                            ) : (
                                                <span className="text-red-700">✗ Incorrect.</span>
                                            )}{' '}
                                            {currentQuiz.explanation || 'Always follow standard operating procedures and contact your site supervisor immediately.'}
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={!quizAnswer}
                                            onClick={() => setQuizSubmitted(true)}
                                            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-xs"
                                        >
                                            Submit Answer
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Complaint Box (Grievance submission) */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="bg-red-50 p-2.5 rounded-xl text-red-500 border border-red-100">
                                <MessageSquareCode className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Confidential Complaint Box</h3>
                                <p className="text-[10px] text-slate-400 font-medium">Direct secure submission channel to HR management.</p>
                            </div>
                        </div>

                        <form onSubmit={handleComplaintSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Grievance Details
                                </label>
                                <textarea
                                    required
                                    value={complaintText}
                                    onChange={(e) => setComplaintText(e.target.value)}
                                    rows={4}
                                    placeholder="Provide detailed description of the issue. Submissions are kept strictly confidential for HR investigation..."
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-50 shadow-sm"
                            >
                                {submittingComplaint ? 'Submitting...' : 'Register Grievance Ticket'}
                            </button>
                        </form>
                    </div>

                </div>

                {/* Right Column: Attendance Calendar */}
                <div className="lg:col-span-6">
                    <AttendanceCalendar userId={userId} userName={userName} />
                </div>

            </div>
        </div>
    );
};

export default EmployeeEngagementHub;
