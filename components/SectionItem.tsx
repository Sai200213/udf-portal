
import React, { useState } from 'react';
import { FormSection, FormField, Role, Site } from '../types';
import FieldItem from './FieldItem';
import Button from './common/Button';
import IconButton from './common/IconButton';
import Input from './common/Input';
import FieldEditorModal from './FieldEditorModal';
import { Edit3, Trash2, ArrowUp, ArrowDown, PlusCircle, GripVertical, Eye, EyeOff } from 'lucide-react';

interface SectionItemProps {
  section: FormSection;
  onUpdateName: (sectionId: string, newName: string) => void;
  onDelete: (sectionId: string) => void;
  onToggleStatus: (sectionId: string) => void;
  onMoveUp: (sectionId: string) => void;
  onMoveDown: (sectionId: string) => void;
  onAddField: (sectionId: string, fieldData: Omit<FormField, 'id' | 'order'>) => void;
  onUpdateField: (sectionId: string, fieldId: string, updates: Partial<Omit<FormField, 'id' | 'order'>>) => void;
  onDeleteField: (sectionId: string, fieldId: string) => void;
  onToggleFieldStatus: (sectionId: string, fieldId: string) => void;
  onReorderFields: (sectionId: string, sourceIndex: number, destinationIndex: number) => void;
  isFirst: boolean;
  isLast: boolean;
  availableFields: FormField[];
  roles: Role[];
  sites: Site[];
}

const SectionItem: React.FC<SectionItemProps> = ({
  section,
  onUpdateName,
  onDelete,
  onToggleStatus,
  onMoveUp,
  onMoveDown,
  onAddField,
  onUpdateField,
  onDeleteField,
  onToggleFieldStatus,
  onReorderFields,
  isFirst,
  isLast,
  availableFields,
  roles,
  sites,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(section.name);
  const [isFieldEditorOpen, setIsFieldEditorOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormField | undefined>(undefined);

  const handleNameSave = () => {
    if (newName.trim()) {
      onUpdateName(section.id, newName.trim());
    }
    setIsEditingName(false);
  };

  const handleOpenAddFieldModal = () => {
    setEditingField(undefined);
    setIsFieldEditorOpen(true);
  };

  const handleOpenEditFieldModal = (field: FormField) => {
    setEditingField(field);
    setIsFieldEditorOpen(true);
  };

  const handleSaveField = (fieldData: Omit<FormField, 'id' | 'order'> | FormField) => {
    if ('id' in fieldData && fieldData.id) { // Existing field
      onUpdateField(section.id, fieldData.id, fieldData);
    } else { // New field
      onAddField(section.id, fieldData as Omit<FormField, 'id' | 'order'>);
    }
  };

  const handleDeleteField = (fieldId: string) => {
    if (window.confirm('Are you sure you want to delete this field? Permanent deletion might break existing submission views.')) {
      onDeleteField(section.id, fieldId);
    }
  };

  const sortedFields = [...section.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const currentIndex = sortedFields.findIndex(f => f.id === fieldId);
    if (currentIndex === -1) return;
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sortedFields.length) return;
    onReorderFields(section.id, currentIndex, newIndex);
  };


  return (
    <div className={`p-4 rounded-lg shadow-md border transition-all ${section.isDisabled ? 'bg-gray-100 border-gray-300 opacity-80' : 'bg-gray-50 border-gray-200 mb-6'}`}>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <GripVertical size={20} className="text-gray-400 cursor-grab" />
          {isEditingName ? (
            <div className="flex items-center space-x-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleNameSave}
                onKeyPress={(e) => e.key === 'Enter' && handleNameSave()}
                autoFocus
                className="text-xl font-semibold"
              />
              <Button onClick={handleNameSave} size="sm">Save</Button>
            </div>
          ) : (
            <div className="flex flex-col">
              <h3 className={`text-xl font-semibold cursor-pointer ${section.isDisabled ? 'text-gray-500 line-through' : 'text-gray-800'}`} onClick={() => setIsEditingName(true)}>
                {section.name}
              </h3>
              {section.isDisabled && <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">Disabled for Applicants</span>}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <IconButton icon={<ArrowUp size={18} />} onClick={() => onMoveUp(section.id)} disabled={isFirst} tooltip="Move Section Up" />
          <IconButton icon={<ArrowDown size={18} />} onClick={() => onMoveDown(section.id)} disabled={isLast} tooltip="Move Section Down" />
          <IconButton
            icon={section.isDisabled ? <EyeOff size={18} className="text-orange-500" /> : <Eye size={18} className="text-blue-500" />}
            onClick={() => onToggleStatus(section.id)}
            tooltip={section.isDisabled ? "Enable Section" : "Disable Section"}
          />
          {!isEditingName && <IconButton icon={<Edit3 size={18} />} onClick={() => setIsEditingName(true)} tooltip="Edit Section Name" />}
          <IconButton icon={<Trash2 size={18} className="text-red-500 hover:text-red-700" />} onClick={() => onDelete(section.id)} tooltip="Delete Section Permanently" />
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {sortedFields.length === 0 && (
          <p className="text-sm text-gray-500 italic text-center py-4">No fields in this section. Add one below.</p>
        )}
        {sortedFields.map((field, index) => (
          <FieldItem
            key={field.id}
            field={field}
            onEdit={() => handleOpenEditFieldModal(field)}
            onDelete={() => handleDeleteField(field.id)}
            onToggleStatus={() => onToggleFieldStatus(section.id, field.id)}
            onMoveUp={() => moveField(field.id, 'up')}
            onMoveDown={() => moveField(field.id, 'down')}
            isFirst={index === 0}
            isLast={index === sortedFields.length - 1}
          />
        ))}
      </div>

      {!section.isDisabled && (
        <Button variant="secondary" onClick={handleOpenAddFieldModal} size="sm" className="w-full">
          <PlusCircle size={16} className="mr-2" /> Add Field to "{section.name}"
        </Button>
      )}

      {isFieldEditorOpen && (
        <FieldEditorModal
          isOpen={isFieldEditorOpen}
          onClose={() => setIsFieldEditorOpen(false)}
          onSave={handleSaveField}
          existingField={editingField}
          sectionId={section.id}
          availableFields={availableFields}
          roles={roles}
          sites={sites}
        />
      )}
    </div>
  );
};

export default SectionItem;

