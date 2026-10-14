import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface PremiumSelectProps {
    label?: string;
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: string;
    searchable?: boolean;
    className?: string;
}

const PremiumSelect: React.FC<PremiumSelectProps> = ({
    label,
    options,
    value,
    onChange,
    placeholder = 'Select an option',
    error,
    searchable = true,
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option: Option) => {
        onChange(option.value);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            {label && (
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-0.5">
                    {label}
                </label>
            )}

            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`
          flex items-center justify-between w-full px-4 py-2.5 bg-white border rounded-xl cursor-pointer transition-all duration-200
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg shadow-blue-500/10' : 'border-gray-200 hover:border-gray-300'}
          ${error ? 'border-red-500' : ''}
        `}
            >
                <span className={`block truncate ${!selectedOption ? 'text-gray-400' : 'text-gray-900 font-medium'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
                    {searchable && (
                        <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                autoFocus
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}

                    <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => handleSelect(option)}
                                    className={`
                    flex items-center justify-between px-3 py-2.5 mb-1 last:mb-0 rounded-xl cursor-pointer transition-colors
                    ${value === option.value ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}
                  `}
                                >
                                    <span className="text-sm font-medium">{option.label}</span>
                                    {value === option.value && <Check size={16} className="text-blue-600" />}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-gray-400 text-sm">
                                No matching options found
                            </div>
                        )}
                    </div>
                </div>
            )}

            {error && <p className="mt-1.5 text-xs text-red-500 font-medium ml-1">{error}</p>}
        </div>
    );
};

export default PremiumSelect;

