import React from 'react';
import toast from 'react-hot-toast';
import { RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';
import { restoreFromRecycleBin } from '../services/recycleBinService';

interface UndoToastOptions {
  message: string;
  recycleBinId?: string;
  onUndo?: () => Promise<void> | void;
  duration?: number;
}

/**
 * Show an interactive Undo toast notification.
 * If user clicks "UNDO", it restores the item from the Recycle Bin and fires a confirmation.
 */
export function showUndoToast({
  message,
  recycleBinId,
  onUndo,
  duration = 8000
}: UndoToastOptions) {
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-slate-900 border border-slate-700 shadow-2xl rounded-xl pointer-events-auto flex items-center justify-between p-3.5 text-white`}
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">{message}</p>
            <p className="text-[11px] text-slate-400">Moved to Recycle Bin</p>
          </div>
        </div>

        <button
          onClick={async () => {
            toast.dismiss(t.id);
            try {
              if (recycleBinId) {
                await restoreFromRecycleBin(recycleBinId);
              }
              if (onUndo) {
                await onUndo();
              }
              toast.custom(
                (successToast) => (
                  <div
                    className={`${
                      successToast.visible ? 'animate-enter' : 'animate-leave'
                    } bg-emerald-950 border border-emerald-600 text-emerald-200 text-xs font-bold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2`}
                  >
                    <CheckCircle size={16} className="text-emerald-400" />
                    <span>Action undone. Record restored successfully!</span>
                  </div>
                ),
                { duration: 4000 }
              );
            } catch (err: any) {
              toast.error(err.message || 'Failed to undo action');
            }
          }}
          className="shrink-0 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm"
        >
          <RotateCcw size={13} className="stroke-[3]" />
          UNDO
        </button>
      </div>
    ),
    { duration }
  );
}
