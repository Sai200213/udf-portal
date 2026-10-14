
import React from 'react';
import { FormField, FieldType } from '../types';
import IconButton from './common/IconButton';
import { Edit3, Trash2, ArrowUp, ArrowDown, Type, ListChecks, ListOrdered, CalendarDays, CheckSquare, UploadCloud, CircleDot, Eye, EyeOff } from 'lucide-react';

interface FieldItemProps {
  field: FormField;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const FieldTypeIcon: React.FC<{type: FieldType}> = ({ type }) => {
  switch (type) {
    case FieldType.TEXT: return <Type size={18} className="text-gray-500" />;
    case FieldType.TEXTAREA: return <ListOrdered size={18} className="text-gray-500" />;
    case FieldType.DROPDOWN: return <ListChecks size={18} className="text-gray-500" />;
    case FieldType.DATE: return <CalendarDays size={18} className="text-gray-500" />;
    case FieldType.CHECKBOX: return <CheckSquare size={18} className="text-gray-500" />;
    case FieldType.RADIO: return <CircleDot size={18} className="text-gray-500" />;
    case FieldType.FILE_UPLOAD: return <UploadCloud size={18} className="text-gray-500" />;
    default: return <Type size={18} className="text-gray-500" />;
  }
};


const FieldItem: React.FC<FieldItemProps> = ({ field, onEdit, onDelete, onToggleStatus, onMoveUp, onMoveDown, isFirst, isLast }) => {
  return (
    <div className={`p-3 border rounded-md shadow-sm flex items-center justify-between transition-all ${field.isDisabled ? 'bg-gray-100 border-gray-300 opacity-70 grayscale' : 'bg-white border-gray-200 hover:shadow-md'}`}>
      <div className="flex items-center space-x-3">
        <FieldTypeIcon type={field.type} />
        <div>
          <p className={`text-sm font-medium ${field.isDisabled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {field.label} {field.isMandatory && <span className="text-red-500">*</span>}
          </p>
          <div className="flex items-center space-x-2">
            <p className="text-xs text-gray-500">{field.type}</p>
            {field.isDisabled && <span className="text-[9px] bg-red-50 text-red-600 px-1 rounded border border-red-100 font-bold uppercase">Disabled</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-1">
        <IconButton icon={<ArrowUp size={18} />} onClick={onMoveUp} disabled={isFirst} tooltip="Move Up" />
        <IconButton icon={<ArrowDown size={18} />} onClick={onMoveDown} disabled={isLast} tooltip="Move Down" />
        <IconButton 
            icon={field.isDisabled ? <EyeOff size={18} className="text-orange-500"/> : <Eye size={18} className="text-blue-500"/>} 
            onClick={onToggleStatus} 
            tooltip={field.isDisabled ? "Enable Field" : "Disable Field"} 
        />
        <IconButton icon={<Edit3 size={18} />} onClick={onEdit} tooltip="Edit Field" />
        <IconButton icon={<Trash2 size={18} className="text-red-500 hover:text-red-700" />} onClick={onDelete} tooltip="Delete Field Permanently" />
      </div>
    </div>
  );
};

export default FieldItem;

