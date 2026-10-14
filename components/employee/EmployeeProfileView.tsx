
import React, { useState, useRef, useEffect } from 'react';
import ProfileAvatar from '../ProfileAvatar';
import { SubmittedFormData, FormField, FieldType, FormSection, PortalConfig } from '../../types';
import { useData } from '../../src/contexts/DataContext';

// Import employee-specific field components for read-only display
import EmployeeTextField from '../employeeFormFields/EmployeeTextField';
import EmployeeTextareaField from '../employeeFormFields/EmployeeTextareaField';
import EmployeeDropdownField from '../employeeFormFields/EmployeeDropdownField';
import EmployeeDateField from '../employeeFormFields/EmployeeDateField';
import EmployeeCheckboxField from '../employeeFormFields/EmployeeCheckboxField';
import EmployeeRadioField from '../employeeFormFields/EmployeeRadioField';
import EmployeeFileUploadField from '../employeeFormFields/EmployeeFileUploadField';
import { FileText, Image as ImageIcon, ExternalLink, Download, Tag, ShieldHalf, AlertTriangle } from 'lucide-react';
import SecureDocumentLink, { SecureImage } from '../../src/components/common/SecureDocumentLink';
import RequestCorrectionModal from '../common/RequestCorrectionModal';
import Button from '../common/Button';
import { Edit3 } from 'lucide-react';

interface EmployeeProfileViewProps {
  employeeData: SubmittedFormData;
  fallbackFormSections?: FormSection[];
  portalConfig?: PortalConfig;
  sites?: any[]; // Allow sites to be passed from parent
  isAdmin?: boolean;
  adminName?: string;
}

const EmployeeProfileView: React.FC<EmployeeProfileViewProps> = ({ 
  employeeData, 
  fallbackFormSections, 
  portalConfig, 
  sites: propSites,
  isAdmin,
  adminName
}) => {
  const { sites: contextSites } = useData();
  const sites = propSites || contextSites; // Fallback to context if prop is missing

  const pendingFieldsList: string[] = (employeeData as any)?.pendingProfileFields || [];
  const isIncompleteProfile = (employeeData as any)?.profileCompletionStatus === 'INCOMPLETE';
  const pendingProfileNote: string | undefined = (employeeData as any)?.pendingProfileNote;

  const renderReadOnlyField = (field: FormField, value: any) => {
    const isPlaceholderValue = (v: any) => {
      if (v === null || v === undefined) return true;
      const s = String(v).trim().toLowerCase();
      return s === '' || ['na', 'n/a', 'n.a.', 'none', 'nil', 'nil.', '-', '--', '0', '00', '0000', '000000000000'].includes(s);
    };

    const isFieldPending = pendingFieldsList.includes(field.id) ||
      (isIncompleteProfile && isPlaceholderValue(value));

    // For file uploads, display the filename if available
    if (field.type === FieldType.FILE_UPLOAD && value instanceof File) {
      return (
        <div className="flex flex-col gap-1.5 min-w-0 pb-1">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between gap-1 truncate">
            <span>{field.label}</span>
            {isFieldPending && (
              <span className="text-[9px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs uppercase tracking-tight shrink-0">
                Pending
              </span>
            )}
          </span>
          <p className="text-sm font-medium text-gray-800 p-2.5 border border-gray-100 rounded-xl bg-gray-50/50 truncate">
            {value.name} ({(value.size / 1024).toFixed(2)} KB)
          </p>
        </div>
      );
    }
    let valPath = typeof value === 'object' && value !== null && 'storagePath' in value
      ? (value as any).storagePath
      : (typeof value === 'string' ? value : null);

    if (field.type === FieldType.FILE_UPLOAD && valPath) {
      const isImageUrl = valPath.match(/\.(jpeg|jpg|gif|png|webp)/i) || valPath.includes('alt=media');
      
      return (
        <div className="flex flex-col gap-1.5 min-w-0 pb-1">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between gap-1 truncate">
            <span>{field.label}</span>
            {isFieldPending && (
              <span className="text-[9px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs uppercase tracking-tight shrink-0">
                Pending Correction
              </span>
            )}
          </span>
          <div className="flex flex-col gap-3 p-3 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100/50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
                {isImageUrl ? <ImageIcon size={18} /> : <FileText size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">Document Attached</p>
                <p className="text-[10px] text-gray-400 truncate font-mono">{field.id}</p>
              </div>
              <SecureDocumentLink 
                path={valPath} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:border-emerald-300 hover:text-emerald-700 transition-colors shadow-sm"
              >
                <ExternalLink size={14} /> Open
              </SecureDocumentLink>
            </div>
            {isImageUrl && (
              <div className="relative overflow-hidden rounded-lg border border-gray-200/50 bg-white">
                <SecureImage 
                  path={valPath} 
                  alt={field.label}
                  className="w-full h-24 object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            )}
          </div>
        </div>
      );
    }
    if (field.type === FieldType.FILE_UPLOAD && !value) {
      return (
        <div className="flex flex-col gap-1.5 min-w-0 pb-1">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between gap-1 truncate">
            <span>{field.label}</span>
            {isFieldPending && (
              <span className="text-[9px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs uppercase tracking-tight shrink-0">
                Pending
              </span>
            )}
          </span>
          <div className={`flex items-center gap-2 p-3 border rounded-xl ${isFieldPending ? 'border-amber-300 bg-amber-50/40 text-amber-700' : 'border-dashed border-gray-200 bg-gray-50/30 text-gray-400'}`}>
            <FileText size={16} className={isFieldPending ? 'text-amber-500' : 'opacity-50'} />
            <span className="text-[11px] uppercase tracking-wide font-semibold">
              {isFieldPending ? 'Pending Document Upload' : 'No Document'}
            </span>
          </div>
        </div>
      );
    }

    // For checkboxes, display selected options
    if (field.type === FieldType.CHECKBOX) {
      const selectedOptions = Array.isArray(value) ? value.join(', ') : (value || 'N/A');
      return (
        <div className="flex flex-col gap-1 min-w-0 pb-1">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between gap-1 truncate">
            <span>{field.label}</span>
            {isFieldPending && (
              <span className="text-[9px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs uppercase tracking-tight shrink-0">
                Pending
              </span>
            )}
          </span>
          <span className="text-sm font-semibold text-gray-800 truncate">{selectedOptions || 'No selection'}</span>
        </div>
      );
    }

    // Default display for text-based inputs
    const displayValue = (val: any) => {
      const isPlaceholder = isPlaceholderValue(val);
      if (isPlaceholder) {
        return isFieldPending
          ? <span className="font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-xs">⚠️ {val ? `"${val}" - Needs Update` : 'Missing / To Be Updated'}</span>
          : <span className="italic text-gray-300 font-normal">Not Provided</span>;
      }
      return (
        <span className="flex items-center gap-2">
          <span>{String(val)}</span>
          {isFieldPending && (
            <span className="text-[9px] font-black uppercase text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs tracking-tight shrink-0">
              Needs Correction
            </span>
          )}
        </span>
      );
    };


    if (field.type === FieldType.DROPDOWN) {
      const matchedOpt = (field.options as any[])?.find(opt => typeof opt === 'string' ? opt === value : opt.value === value);
      const optLabel = matchedOpt ? (typeof matchedOpt === 'string' ? matchedOpt : matchedOpt.label) : null;
      const matchedSite = sites?.find(s => s.id === value || s.name === value);
      const resolvedText = optLabel || matchedSite?.name || value;
      return (
        <div className="flex flex-col gap-1 min-w-0 pb-1">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between gap-1 break-words">
            <span>{field.label}</span>
            {isFieldPending && (
              <span className="text-[9px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs uppercase tracking-tight shrink-0">
                Pending
              </span>
            )}
          </span>
          <span className="text-[15px] font-semibold text-gray-800 break-words">
            {displayValue(resolvedText)}
          </span>
        </div>
      );
    }

    switch (field.type) {
      case FieldType.TEXT:
      case FieldType.TEXTAREA:
      case FieldType.DATE:
      case FieldType.RADIO:
        return (
          <div className="flex flex-col gap-1 min-w-0 pb-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between gap-1 break-words">
              <span>{field.label}</span>
              {isFieldPending && (
                <span className="text-[9px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs uppercase tracking-tight shrink-0">
                  Pending
                </span>
              )}
            </span>
            <span className={`text-[15px] font-semibold text-gray-800 break-words ${field.type === FieldType.TEXTAREA ? 'whitespace-pre-wrap leading-relaxed' : ''}`}>
              {displayValue(value)}
            </span>
          </div>
        );
      default:
        return (
          <div className="flex flex-col gap-1 min-w-0 pb-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between gap-1 break-words">
              <span>{field.label}</span>
              {isFieldPending && (
                <span className="text-[9px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs uppercase tracking-tight shrink-0">
                  Pending
                </span>
              )}
            </span>
            <span className="text-[15px] font-semibold text-gray-800 break-words">
              {displayValue(value)}
            </span>
          </div>
        );
    }
  };

  const sectionsToRender = employeeData.originalFormSections || fallbackFormSections || [];

  const allFields = sectionsToRender.flatMap(s => s.fields || []);
  const designationFieldId = allFields.find(f => f.label?.toLowerCase().includes('designation') || f.label?.toLowerCase().includes('role') || f.label?.toLowerCase().includes('position') || f.label?.toLowerCase().includes('title'))?.id;
  const siteFieldId = allFields.find(f => f.label?.toLowerCase().includes('unit') || f.label?.toLowerCase().includes('facility') || f.label?.toLowerCase().includes('site') || f.label?.toLowerCase().includes('location'))?.id;

  const [popoverSite, setPopoverSite] = useState<any | null>(null);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopoverSite(null);
      }
    };
    if (popoverSite) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoverSite]);

  const dataMap = employeeData.data || employeeData.formData || {};

  const rawDesignation = employeeData.designation || (designationFieldId ? dataMap[designationFieldId] : null);
  const displayDesignation = rawDesignation && rawDesignation !== 'N/A' ? rawDesignation : null;

  const rawSiteVal = (employeeData.siteName && employeeData.siteName !== 'N/A' ? employeeData.siteName : null) || 
    employeeData.unitName || 
    employeeData.location || 
    (siteFieldId ? dataMap[siteFieldId] : null) || 
    (employeeData as any).currentSiteId;
  const matchedSite = sites?.find(s => s.id === rawSiteVal || s.name === rawSiteVal || s.id === (employeeData as any).currentSiteId);
  const displaySiteName = matchedSite ? matchedSite.name : (rawSiteVal && rawSiteVal !== 'N/A' ? rawSiteVal : null);

  return (
    <div className="max-w-[1400px] mx-auto pb-12">
      {/* Premium Header Profile Card */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 mb-8 relative">
        <div className="h-32 md:h-48 bg-gradient-to-tr from-emerald-600 via-teal-500 to-green-400 relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>
        
        <div className="px-6 md:px-10 pb-8 flex flex-col md:flex-row gap-6 -mt-16 md:-mt-20 relative z-10">
          <div className="ring-4 ring-white rounded-full bg-white self-start flex-shrink-0">
            <ProfileAvatar
              userId={employeeData.employeeId || employeeData.id}
              userName={employeeData.applicantName || employeeData.employeeId || 'Employee'}
              currentPhotoURL={employeeData.profilePhotoURL}
              size={120}
              editable={true}
              collection="employees"
            />
          </div>
          
          <div className="flex-1 mt-16 md:mt-20 pb-2 relative">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              {employeeData.applicantName || 'Employee Profile'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {employeeData.employeeId && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                  {(employeeData.employeeId).toUpperCase()}
                </span>
              )}
              {displayDesignation && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-100">
                  {String(displayDesignation)}
                </span>
              )}
              {displaySiteName && (
                <button 
                  onClick={() => {
                    const site = sites?.find(s => s.id === (employeeData as any).currentSiteId || s.name === displaySiteName);
                    if (site) setPopoverSite({ name: displaySiteName, site });
                  }}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  {String(displaySiteName)}
                </button>
              )}
              
              {/* Secondary Assignments */}
              {((employeeData as any).activeAssignments || [])
                .filter((a: any) => a.type !== 'PRIMARY' && a.status === 'Active')
                .map((assignment: any) => {
                  const site = sites?.find(s => s.id === assignment.siteId);
                  const assignedSiteName = site ? site.name : 'Unknown Site';
                  return (
                    <React.Fragment key={assignment.id}>
                      {assignment.designation && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100" title="Secondary Assignment Designation">
                          📝 {assignment.type === 'OT' ? 'OT: ' : ''}{assignment.designation}
                        </span>
                      )}
                      <button 
                        onClick={() => {
                          if (site) setPopoverSite({ name: assignedSiteName, site });
                        }}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-100 hover:bg-violet-100 transition-colors cursor-pointer"
                        title="Secondary Assignment Site"
                      >
                        🏢 {assignedSiteName}
                      </button>
                    </React.Fragment>
                  );
                })}
              {isAdmin && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCorrectionModalOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 ml-auto"
                >
                  <Edit3 size={14} /> Request Profile Correction
                </Button>
              )}
            </div>

            {popoverSite && (
              <div 
                ref={popoverRef}
                className="absolute left-0 mt-3 z-[999] w-72 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5"
                style={{ top: '100%' }}
              >
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldHalf size={16} className="text-white/80" />
                    <span className="text-[11px] font-bold text-white uppercase tracking-widest">{popoverSite.name} Identifiers</span>
                  </div>
                  <button onClick={() => setPopoverSite(null)} className="text-white/60 hover:text-white transition-colors">
                    <ExternalLink size={14} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  {(popoverSite.site?.requiredClientIdIds || []).length > 0 ? (
                    popoverSite.site.requiredClientIdIds.map((id: string) => {
                      const def = (portalConfig?.clientIdDefinitions || []).find(d => d.id === id);
                      if (!def || def.isDisabled) return null;
                      const rawValue = employeeData.clientIds?.[id];
                      return (
                        <div key={id} className="group">
                          <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1 block">{def.name || id}</label>
                          <div className="flex items-center justify-between bg-gray-50/80 px-3 py-2.5 rounded-xl border border-gray-100 group-hover:border-indigo-100 group-hover:bg-indigo-50/30 transition-all">
                            <span className="text-sm font-bold text-gray-800">
                              {rawValue || <span className="italic text-gray-400 font-medium">Pending Assignment</span>}
                            </span>
                            {rawValue && <Tag size={12} className="text-indigo-300" />}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center py-4 text-center">
                      <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                        <Tag size={18} className="text-gray-300" />
                      </div>
                      <p className="text-xs text-gray-500 font-medium italic px-4">No specific IDs are currently required for this unit.</p>
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 px-4 py-2 border-t border-gray-100">
                  <p className="text-[9px] text-gray-400 font-medium text-center italic">These IDs are client-specific and used for site verification.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isIncompleteProfile && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5 md:mt-0">
              <AlertTriangle size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-black text-amber-900 uppercase tracking-wide">
                  Incomplete Profile — Pending Details
                </h4>
                <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                  Joining Confirmed
                </span>
              </div>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                This employee was confirmed with pending compliance details on joining day. The fields highlighted below with <span className="font-bold text-amber-900 bg-amber-100 px-1 py-0.5 rounded">Pending</span> badges need to be updated.
              </p>
              {pendingProfileNote && (
                <p className="text-xs text-amber-800/90 font-medium italic mt-1.5 bg-amber-100/60 px-3 py-1.5 rounded-lg border border-amber-200">
                  <span className="font-bold not-italic">Approver Note:</span> "{pendingProfileNote}"
                </p>
              )}
              {pendingFieldsList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="text-[11px] font-bold text-amber-800 self-center mr-1">Pending Fields:</span>
                  {pendingFieldsList.map((fId) => {
                    let fieldLabel = fId;
                    for (const sec of sectionsToRender) {
                      const f = (sec.fields || []).find(x => x.id === fId);
                      if (f) { fieldLabel = f.label; break; }
                    }
                    return (
                      <span key={fId} className="px-2 py-0.5 bg-white border border-amber-300 text-amber-800 rounded text-[11px] font-semibold shadow-2xs">
                        {fieldLabel}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {[...(sectionsToRender)].sort((a, b) => a.order - b.order).map((section, idx) => {
            const filteredFields = (section.fields || []).filter(f => 
              !f.label?.toLowerCase().includes('client id') &&
              !f.label?.toLowerCase().includes('client-specific id')
            );
            
            if (filteredFields.length === 0) return null;

            return (
              <div key={section.id} className="bg-white border border-gray-100 shadow-sm rounded-[2rem] overflow-hidden group hover:shadow-md transition-all duration-300">
                <div className="px-8 py-5 border-b border-gray-50 bg-white/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center font-mono text-xs font-bold">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight">{section.name}</h3>
                  </div>
                </div>
                
                <div className="p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
                    {[...filteredFields].sort((a, b) => a.order - b.order).map(field => (
                      <div key={field.id} className={`${field.type === FieldType.TEXTAREA ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
                        {renderReadOnlyField(field, (employeeData.data || {})[field.id])}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {isCorrectionModalOpen && (
        <RequestCorrectionModal
          isOpen={isCorrectionModalOpen}
          onClose={() => setIsCorrectionModalOpen(false)}
          targetId={employeeData.id || employeeData.employeeId}
          targetType="employee"
          applicantName={employeeData.applicantName || 'Employee'}
          formSections={sectionsToRender}
          createdBy={adminName || 'Admin'}
        />
      )}
    </div>
  );
};

export default EmployeeProfileView;

