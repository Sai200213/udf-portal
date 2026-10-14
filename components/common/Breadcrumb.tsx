import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
    label: string;
    path?: string;
    active?: boolean;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    onNavigate?: (path: string) => void;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onNavigate }) => {
    return (
        <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide py-1">
            <div
                className="flex items-center hover:text-blue-600 cursor-pointer transition-colors"
                onClick={() => onNavigate?.('/')}
            >
                <Home size={16} className="mr-1.5" />
            </div>

            {items.map((item, index) => (
                <React.Fragment key={index}>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                    <div
                        className={`
              flex items-center transition-colors
              ${item.active ? 'text-gray-900 font-bold' : 'hover:text-blue-600 cursor-pointer'}
            `}
                        onClick={() => !item.active && item.path && onNavigate?.(item.path)}
                    >
                        {item.label}
                    </div>
                </React.Fragment>
            ))}
        </nav>
    );
};

export default Breadcrumb;

