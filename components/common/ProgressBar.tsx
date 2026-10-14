
import React from 'react';
import { Check } from 'lucide-react';

interface ProgressBarProps {
  sections: string[];
  currentStep: number; // 0-indexed
  // onStepClick?: (stepIndex: number) => void; // Future: allow clicking to navigate
}

const ProgressBar: React.FC<ProgressBarProps> = ({ sections, currentStep }) => {
  return (
    <nav aria-label="Progress">
      {/* Mobile step text indicator */}
      <div className="flex sm:hidden justify-between items-center text-xs text-gray-500 mb-2.5 font-medium px-0.5">
        <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md text-[11px]">
          Step {currentStep + 1} of {sections.length}
        </span>
        <span className="font-semibold text-gray-700 truncate max-w-[200px] text-right">
          {sections[currentStep]}
        </span>
      </div>

      <ol role="list" className="flex items-center justify-between space-x-1 sm:space-x-2 md:space-x-4">
        {sections.map((sectionName, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <li key={sectionName} className="relative flex-1">
              {/* Connecting line (except for the first item) */}
              {index > 0 && (
                <div
                  className={`absolute inset-0 top-3 sm:top-4 right-1/2 -z-10 h-0.5 w-full 
                              ${isCompleted || isActive ? 'bg-blue-600' : 'bg-gray-300'}`}
                  aria-hidden="true"
                />
              )}
              
              <div className="flex flex-col items-center text-center">
                <div
                  className={`flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm
                              ${isCompleted ? 'bg-blue-600 hover:bg-blue-700' : ''}
                              ${isActive ? 'border-2 border-blue-600 bg-white shadow-xs' : ''}
                              ${isUpcoming ? 'border-2 border-gray-300 bg-white hover:border-gray-400' : ''}
                              transition-colors duration-150 ease-in-out`}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-white" aria-hidden="true" />
                  ) : (
                    <span
                      className={`${isActive ? 'text-blue-600' : 'text-gray-500'} 
                                  font-semibold`}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>
                {/* Removed section name paragraph */}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default ProgressBar;

