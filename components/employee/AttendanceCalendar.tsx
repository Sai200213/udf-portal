import React, { useState, useEffect, useMemo } from 'react';
import { getEmployeeAttendanceForMonth, markAttendanceForDate, getLocalDateString, AttendanceRecord } from '../../src/services/engagementService';
import { CalendarCheck, ChevronLeft, ChevronRight, CheckCircle, Info, X } from 'lucide-react';

interface AttendanceCalendarProps {
    userId: string;
    userName: string;
}

const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ userId, userName }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<'P' | 'A' | 'W/O'>('P');
    const [ideaText, setIdeaText] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const todayStr = useMemo(() => getLocalDateString(), []);
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-indexed

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    useEffect(() => {
        loadAttendance();
    }, [userId, currentYear, currentMonth]);

    const loadAttendance = async () => {
        setLoading(true);
        try {
            // Month in DB query is 1-indexed, so currentMonth + 1
            const monthRecords = await getEmployeeAttendanceForMonth(userId, currentYear, currentMonth + 1);
            setRecords(monthRecords);
        } catch (err) {
            console.error("Failed to load attendance records:", err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate days in the current month
    const daysInMonth = useMemo(() => {
        return new Date(currentYear, currentMonth + 1, 0).getDate();
    }, [currentYear, currentMonth]);

    // Calculate the day of the week the month starts on
    const startDayOfWeek = useMemo(() => {
        return new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday, 1 = Monday...
    }, [currentYear, currentMonth]);

    // Navigate to previous month
    const handlePrevMonth = () => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() - 1);
            return d;
        });
    };

    // Navigate to next month
    const handleNextMonth = () => {
        setCurrentDate(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + 1);
            return d;
        });
    };

    // Check what record exists for a specific day
    const getRecordForDay = (day: number): AttendanceRecord | undefined => {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return records.find(r => r.date === dateStr);
    };

    // Handle day click
    const handleDayClick = (day: number) => {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (dateStr === todayStr) {
            // Open modal to mark today's attendance
            const existing = getRecordForDay(day);
            if (existing) {
                setSelectedStatus(existing.status);
                setIdeaText(existing.idea || '');
            } else {
                setSelectedStatus('P');
                setIdeaText('');
            }
            setIsModalOpen(true);
        }
    };

    const handleSaveAttendance = async () => {
        setSaving(true);
        setMessage('');
        try {
            // Check if they already have an attendance record for today in the records list
            const hasAlreadyMarkedToday = records.some(r => r.date === todayStr);

            const success = await markAttendanceForDate(userId, userName, todayStr, selectedStatus, ideaText);
            if (success) {
                setMessage('Attendance marked successfully!');
                await loadAttendance();

                // If marked as Present today and they had NOT already checked in today, award points!
                if (selectedStatus === 'P' && !hasAlreadyMarkedToday) {
                    try {
                        const { db } = await import('../../src/firebase/config');
                        const { doc, getDoc, setDoc } = await import('firebase/firestore');

                        // 1. Fetch configured attendance points value
                        let pointsToAdd = 5; // fallback
                        const rulesRef = doc(db, 'settings', 'gamification_rules');
                        const rulesSnap = await getDoc(rulesRef);
                        if (rulesSnap.exists()) {
                            pointsToAdd = rulesSnap.data().attendancePoints ?? 5;
                        }

                        // 2. Load user streak record to add points
                        const streakRef = doc(db, 'user_engagement', userId);
                        const streakSnap = await getDoc(streakRef);
                        let currentPoints = 0;
                        let streakData = {};
                        if (streakSnap.exists()) {
                            streakData = streakSnap.data();
                            currentPoints = streakSnap.data().points || 0;
                        }

                        await setDoc(streakRef, {
                            ...streakData,
                            userId,
                            userName,
                            points: currentPoints + pointsToAdd
                        }, { merge: true });
                        console.log(`[ATTENDANCE POINTS] Awarded +${pointsToAdd} points to ${userName}`);
                    } catch (pointsErr) {
                        console.error("Failed to award attendance points:", pointsErr);
                    }
                }

                setTimeout(() => {
                    setIsModalOpen(false);
                    setMessage('');
                }, 1000);
            } else {
                setMessage('Failed to save attendance record.');
            }
        } catch (err) {
            console.error("Error saving attendance:", err);
            setMessage('Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    // Monthly stats calculation
    const stats = useMemo(() => {
        let pCount = 0;
        let aCount = 0;
        let woCount = 0;
        records.forEach(r => {
            if (r.status === 'P') pCount++;
            else if (r.status === 'A') aCount++;
            else if (r.status === 'W/O') woCount++;
        });
        return { pCount, aCount, woCount };
    }, [records]);

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm font-sans flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2.5">
                    <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 text-emerald-600">
                        <CalendarCheck size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Attendance Calendar</h3>
                        <p className="text-[10px] text-slate-500 font-semibold">Click today to mark/edit attendance.</p>
                    </div>
                </div>

                {/* Month navigation */}
                <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 p-1 rounded-xl">
                    <button 
                        onClick={handlePrevMonth} 
                        className="p-1.5 hover:bg-white hover:shadow-xs rounded-lg text-slate-600 transition-all"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-extrabold text-slate-800 min-w-[100px] text-center">
                        {monthNames[currentMonth]} {currentYear}
                    </span>
                    <button 
                        onClick={handleNextMonth} 
                        className="p-1.5 hover:bg-white hover:shadow-xs rounded-lg text-slate-600 transition-all"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col justify-between">
                    <div>
                        {/* Day names */}
                        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Sun</span>
                            <span>Mon</span>
                            <span>Tue</span>
                            <span>Wed</span>
                            <span>Thu</span>
                            <span>Fri</span>
                            <span>Sat</span>
                        </div>

                        {/* Calendar cells */}
                        <div className="grid grid-cols-7 gap-2">
                            {/* Empty pads for starting day offset */}
                            {Array.from({ length: startDayOfWeek }).map((_, idx) => (
                                <div key={`pad-${idx}`} className="aspect-square bg-slate-50/50 rounded-xl" />
                            ))}

                            {/* Actual days */}
                            {Array.from({ length: daysInMonth }).map((_, idx) => {
                                const dayNum = idx + 1;
                                const record = getRecordForDay(dayNum);
                                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                const isToday = dateStr === todayStr;

                                // Colors based on status
                                let cellStyle = "bg-slate-50 border-transparent text-slate-700 hover:bg-slate-100 hover:border-slate-200";
                                let labelBadge = "";

                                if (record) {
                                    if (record.status === 'P') {
                                        cellStyle = "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70";
                                        labelBadge = "P";
                                    } else if (record.status === 'A') {
                                        cellStyle = "bg-red-50 border-red-200 text-red-800 hover:bg-red-100/70";
                                        labelBadge = "A";
                                    } else if (record.status === 'W/O') {
                                        cellStyle = "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/70";
                                        labelBadge = "W/O";
                                    }
                                }

                                if (isToday) {
                                    cellStyle += " ring-2 ring-blue-500 ring-offset-1 font-black";
                                }

                                return (
                                    <div
                                        key={`day-${dayNum}`}
                                        onClick={() => handleDayClick(dayNum)}
                                        className={`aspect-square border rounded-xl flex flex-col items-center justify-center relative cursor-pointer transition-all duration-200 ${cellStyle}`}
                                    >
                                        <span className="text-xs">{dayNum}</span>
                                        {labelBadge && (
                                            <span className={`absolute bottom-1 text-[8px] font-extrabold px-1 rounded-sm ${
                                                record?.status === 'P' ? 'bg-emerald-100 text-emerald-800' :
                                                record?.status === 'A' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {labelBadge}
                                            </span>
                                        )}
                                        {isToday && !record && (
                                            <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stats and Help Legend */}
                    <div className="mt-6 pt-5 border-t border-slate-100">
                        {/* Legend */}
                        <div className="flex items-center justify-center space-x-4 mb-4 text-[10px] font-bold text-slate-500">
                            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300 mr-1.5" /> Present (P)</span>
                            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300 mr-1.5" /> Absent (A)</span>
                            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300 mr-1.5" /> Weekly Off (W/O)</span>
                        </div>

                        {/* Month stats summary */}
                        <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-150 p-3 rounded-2xl text-center">
                            <div>
                                <span className="text-xs font-semibold text-slate-400 block">Present</span>
                                <span className="text-lg font-black text-emerald-700">{stats.pCount}</span>
                            </div>
                            <div className="border-x border-slate-200">
                                <span className="text-xs font-semibold text-slate-400 block">Absent</span>
                                <span className="text-lg font-black text-red-700">{stats.aCount}</span>
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-slate-400 block">Weekly Off</span>
                                <span className="text-lg font-black text-amber-700">{stats.woCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Attendance Marking Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl border max-w-md w-full shadow-2xl p-6 relative">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 text-slate-400"
                        >
                            <X size={18} />
                        </button>

                        <h3 className="text-lg font-bold text-slate-900 mb-2">Mark Today's Attendance</h3>
                        <p className="text-xs text-slate-500 font-semibold mb-6">Select your status for today ({todayStr}).</p>

                        <div className="space-y-4">
                            {/* Radio Choices */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'P', label: 'Present', desc: 'Working shift', color: 'border-emerald-200 hover:bg-emerald-50 bg-emerald-50/10 text-emerald-800' },
                                    { id: 'A', label: 'Absent', desc: 'Duty off / Sick', color: 'border-red-200 hover:bg-red-50 bg-red-50/10 text-red-800' },
                                    { id: 'W/O', label: 'Weekly Off', desc: 'Rostered WO', color: 'border-amber-200 hover:bg-amber-50 bg-amber-50/10 text-amber-800' }
                                ].map(opt => {
                                    const isSelected = selectedStatus === opt.id;
                                    return (
                                        <div
                                            key={opt.id}
                                            onClick={() => setSelectedStatus(opt.id as any)}
                                            className={`border rounded-2xl p-3 text-center cursor-pointer transition-all duration-200 ${
                                                isSelected 
                                                    ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/20 font-bold' 
                                                    : opt.color
                                            }`}
                                        >
                                            <span className="text-xs block font-bold mb-1">{opt.label}</span>
                                            <span className="text-[9px] text-slate-400 font-semibold leading-none">{opt.desc}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Dynamic Work Idea Input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Daily Shift Insight / Idea (Optional)
                                </label>
                                <textarea
                                    value={ideaText}
                                    onChange={(e) => setIdeaText(e.target.value)}
                                    placeholder="Share any site issues, insights, or positive highlights from your shift..."
                                    rows={3}
                                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {message && (
                                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                                    message.includes('success') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                                }`}>
                                    {message.includes('success') ? <CheckCircle size={14} /> : <Info size={14} />}
                                    <span>{message}</span>
                                </div>
                            )}

                            <button
                                onClick={handleSaveAttendance}
                                disabled={saving}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 shadow-sm"
                            >
                                {saving ? 'Saving...' : 'Confirm Attendance'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceCalendar;
