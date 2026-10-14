
import React from 'react';
import { WorkflowConfig, Role, ApprovalLevel, PortalConfig, ClientIdDefinition } from '../types';
import Button from './common/Button';
import Select from './common/Select';
import Input from './common/Input';
import { GitBranch, Plus, Trash2, ArrowRight, ToggleLeft, ToggleRight, Layout, CalendarCheck, UserCheck, UserMinus, Gavel, ShieldHalf, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';

interface AdminWorkflowConfigPageProps {
  workflowConfigs: WorkflowConfig[];
  setWorkflowConfigs: React.Dispatch<React.SetStateAction<WorkflowConfig[]>>;
  roles: Role[];
  // New props for portal configuration
  portalConfig: PortalConfig;
  setPortalConfig: React.Dispatch<React.SetStateAction<PortalConfig>>;
  activeTab?: 'MODULES' | 'WORKFLOWS' | 'CLIENT_IDS';
  logAction?: (actionType: any, targetModule: any, details: string) => void;
}

const AdminWorkflowConfigPage: React.FC<AdminWorkflowConfigPageProps> = ({ workflowConfigs, setWorkflowConfigs, roles, portalConfig, setPortalConfig, activeTab = 'WORKFLOWS', logAction }) => {
  const [expandedIds, setExpandedIds] = React.useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const addLevel = (moduleId: 'LEAVES' | 'ACCOUNT_UPDATES' | 'SUBMISSIONS' | 'RESIGNATIONS') => {
    setWorkflowConfigs(prev => prev.map(config => {
      if (config.moduleId === moduleId) {
        const nextLevel = config.levels.length + 1;
        if(logAction) logAction('UPDATE', 'SYSTEM', `Added Level ${nextLevel} to ${moduleId} workflow`);
        return {
          ...config,
          levels: [...config.levels, { level: nextLevel, roleId: roles[0]?.id || '' }]
        };
      }
      return config;
    }));
  };

  const removeLevel = (moduleId: 'LEAVES' | 'ACCOUNT_UPDATES' | 'SUBMISSIONS' | 'RESIGNATIONS', levelNum: number) => {
    setWorkflowConfigs(prev => prev.map(config => {
      if (config.moduleId === moduleId) {
        if (config.levels.length === 1) return config; // Must have at least one
        if(logAction) logAction('UPDATE', 'SYSTEM', `Removed Level ${levelNum} from ${moduleId} workflow`);
        const newLevels = config.levels
          .filter(l => l.level !== levelNum)
          .map((l, i) => ({ ...l, level: i + 1 }));
        return { ...config, levels: newLevels };
      }
      return config;
    }));
  };

  const updateLevelRole = (moduleId: 'LEAVES' | 'ACCOUNT_UPDATES' | 'SUBMISSIONS' | 'RESIGNATIONS', levelNum: number, roleId: string) => {
    setWorkflowConfigs(prev => prev.map(config => {
      if (config.moduleId === moduleId) {
        const roleName = roles.find(r => r.id === roleId)?.name || 'Unknown Role';
        if(logAction) logAction('UPDATE', 'SYSTEM', `Updated ${moduleId} workflow: Level ${levelNum} assigned to ${roleName}`);
        const newLevels = config.levels.map(l => l.level === levelNum ? { ...l, roleId } : l);
        return { ...config, levels: newLevels };
      }
      return config;
    }));
  };

  const toggleModule = (key: keyof PortalConfig) => {
      setPortalConfig(prev => {
          const newState = !prev[key];
          if(logAction) logAction('UPDATE', 'SYSTEM', `${newState ? 'Enabled' : 'Disabled'} module: ${key}`);
          return { ...prev, [key]: newState };
      });
  };

  const renderWorkflow = (moduleId: 'LEAVES' | 'ACCOUNT_UPDATES' | 'SUBMISSIONS' | 'RESIGNATIONS', title: string) => {
    const config = workflowConfigs.find(c => c.moduleId === moduleId);
    if (!config) return null;

    return (
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <GitBranch size={24} className="mr-2 text-blue-600" />
            {title} Approval Flow
          </h3>
          <Button variant="secondary" size="sm" onClick={() => addLevel(moduleId)}>
            <Plus size={16} className="mr-1" /> Add Level
          </Button>
        </div>

        <div className="space-y-4">
          {config.levels.map((lvl, index) => (
            <div key={lvl.level} className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold border-2 border-blue-200">
                {lvl.level}
              </div>
              <div className="flex-grow">
                <Select 
                  label={`Level ${lvl.level} Reviewer Role`}
                  value={lvl.roleId} 
                  onChange={e => updateLevelRole(moduleId, lvl.level, e.target.value)}
                >
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </div>
              {config.levels.length > 1 && (
                <button 
                  onClick={() => removeLevel(moduleId, lvl.level)}
                  className="mt-6 p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-8 p-4 bg-blue-50 rounded-lg flex items-start text-sm text-blue-700">
          <ArrowRight size={18} className="mr-2 mt-0.5 flex-shrink-0" />
          <p>
            When {moduleId === 'SUBMISSIONS' ? 'an applicant' : 'an employee'} submits a {title.toLowerCase()}, it will follow this sequence. 
            Once all levels approve, the request becomes final.
          </p>
        </div>
      </div>
    );
  };

  const renderModuleToggle = (key: keyof PortalConfig, label: string, icon: React.ReactNode, description: string) => {
      const isEnabled = portalConfig[key];
      return (
        <div className={`p-4 rounded-lg border flex items-start justify-between transition-colors ${isEnabled ? 'bg-white border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-start">
                <div className={`p-2 rounded-md mr-3 ${isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {icon}
                </div>
                <div>
                    <h4 className={`font-bold ${isEnabled ? 'text-gray-800' : 'text-gray-500'}`}>{label}</h4>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs">{description}</p>
                </div>
            </div>
            <button onClick={() => toggleModule(key)} className="ml-4 focus:outline-none">
                {isEnabled ? (
                    <ToggleRight size={40} className="text-green-500 hover:text-green-600 transition-colors" />
                ) : (
                    <ToggleLeft size={40} className="text-gray-400 hover:text-gray-500 transition-colors" />
                )}
            </button>
        </div>
      );
  };

  const addClientIdDefinition = () => {
    const newId: ClientIdDefinition = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New ID Type',
      fieldType: 'text',
      isRequiredByDefault: false
    };
    setPortalConfig(prev => {
      const current = prev.clientIdDefinitions || [];
      return { ...prev, clientIdDefinitions: [...current, newId] };
    });
    if(logAction) logAction('CREATE', 'SYSTEM', `Added new Client ID Definition: New ID Type`);
  };

  const updateClientIdDefinition = (id: string, updates: Partial<ClientIdDefinition>) => {
    setPortalConfig(prev => {
      const current = prev.clientIdDefinitions || [];
      return {
        ...prev,
        clientIdDefinitions: current.map(d => d.id === id ? { ...d, ...updates } : d)
      };
    });
  };

  const removeClientIdDefinition = (id: string) => {
    const defName = portalConfig.clientIdDefinitions?.find(d => d.id === id)?.name || 'Unknown';
    setPortalConfig(prev => ({
      ...prev,
      clientIdDefinitions: (prev.clientIdDefinitions || []).filter(d => d.id !== id)
    }));
    if(logAction) logAction('DELETE', 'SYSTEM', `Deleted Client ID Definition: ${defName}`);
  };

  return (
    <div className="space-y-12">
        {/* Global Module Visibility Section */}
        {activeTab === 'MODULES' && (
            <section>
                <div className="mb-6 flex items-center">
                    <Layout className="text-purple-600 mr-3" size={28} />
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Employee Portal Modules</h2>
                        <p className="text-gray-500">Enable or disable specific features visible on the employee dashboard sidebar.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderModuleToggle(
                        'enableLeaves', 
                        'Leave Requests', 
                        <CalendarCheck size={20}/>, 
                        'Allow employees to apply for leaves and view balances.'
                    )}
                    {renderModuleToggle(
                        'enableAccountUpdates', 
                        'Account Updates', 
                        <UserCheck size={20}/>, 
                        'Allow employees to request changes to their profile data.'
                    )}
                    {renderModuleToggle(
                        'enableResignations', 
                        'Resignation', 
                        <UserMinus size={20}/>, 
                        'Allow employees to submit resignation letters digitally.'
                    )}
                    {renderModuleToggle(
                        'enableDisciplinary', 
                        'Disciplinary Records', 
                        <Gavel size={20}/>, 
                        'Allow employees to view their disciplinary history and warnings.'
                    )}
                </div>
            </section>
        )}

        {/* Client ID Library Section */}
        {activeTab === 'CLIENT_IDS' && (
            <section>
                <div className="mb-6 flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center">
                        <ShieldHalf className="text-blue-600 mr-3" size={28} />
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">Global Client ID Library</h2>
                            <p className="text-gray-500">Define standard ID types (BPSS, TMS, etc.) and validation rules used across sites.</p>
                        </div>
                    </div>
                    <Button onClick={addClientIdDefinition} variant="primary">
                        <Plus size={18} className="mr-2" /> Define New ID Type
                    </Button>
                </div>

                <div className="space-y-4">
                    {(!portalConfig.clientIdDefinitions || portalConfig.clientIdDefinitions.length === 0) ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                            <p className="text-gray-500">No ID types defined yet. Click "Define New ID Type" to get started.</p>
                        </div>
                    ) : (
                        portalConfig.clientIdDefinitions.map((def) => {
                            const isExpanded = expandedIds.includes(def.id);
                            const isDisabled = def.isDisabled || false;

                            return (
                                <div key={def.id} className={`bg-white rounded-lg shadow-sm border transition-all overflow-hidden ${isDisabled ? 'opacity-60 border-gray-200' : 'border-gray-200 hover:border-blue-300'}`}>
                                    {/* Collapsible Header */}
                                    <div 
                                        className={`px-6 py-4 flex items-center justify-between cursor-pointer select-none ${isExpanded ? 'bg-blue-50/50 border-b border-blue-100' : 'hover:bg-gray-50'}`}
                                        onClick={() => toggleExpand(def.id)}
                                    >
                                        <div className="flex items-center space-x-3">
                                            {isExpanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
                                            <div className="flex flex-col">
                                                <div className="flex items-center space-x-2">
                                                    <span className={`font-bold transition-colors ${isExpanded ? 'text-blue-700' : 'text-gray-800'}`}>
                                                        {def.name || 'Untitled ID Type'}
                                                    </span>
                                                    {isDisabled && (
                                                        <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter flex items-center">
                                                            <EyeOff size={10} className="mr-1" /> Disabled
                                                        </span>
                                                    )}
                                                    {def.isRequiredByDefault && (
                                                        <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                                {!isExpanded && (
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                        {def.fieldType} • {def.pattern ? 'Validated' : 'No Format'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                                            <button 
                                                onClick={() => updateClientIdDefinition(def.id, { isDisabled: !isDisabled })}
                                                className={`p-2 rounded-lg transition-colors ${isDisabled ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                                title={isDisabled ? 'Enable this ID type' : 'Disable this ID type'}
                                            >
                                                {isDisabled ? <Eye size={18} /> : <EyeOff size={18} />}
                                            </button>
                                            <button 
                                                onClick={() => removeClientIdDefinition(def.id)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete ID Type"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Configuration Body */}
                                    {isExpanded && (
                                        <div className="p-6 bg-white animate-in slide-in-from-top-2 duration-200">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <div className="space-y-4">
                                                    <Input
                                                        label="ID Display Name"
                                                        value={def.name}
                                                        onChange={(e) => updateClientIdDefinition(def.id, { name: e.target.value })}
                                                        placeholder="e.g. BPSS ID"
                                                    />
                                                    <Select
                                                        label="Field Type"
                                                        value={def.fieldType}
                                                        onChange={(e) => updateClientIdDefinition(def.id, { fieldType: e.target.value as any })}
                                                    >
                                                        <option value="text">Standard Text</option>
                                                        <option value="uppercase">Force Uppercase</option>
                                                        <option value="number">Numeric Only</option>
                                                    </Select>
                                                </div>

                                                <div className="space-y-4">
                                                    <Select
                                                        label="Validation Format"
                                                        value={def.pattern === '^[0-9]*$' ? 'numeric' : 
                                                               def.pattern === '^[a-zA-Z0-9]*$' ? 'alphanumeric' :
                                                               def.pattern === '^[a-zA-Z ]*$' ? 'alpha' :
                                                               def.pattern === '^[a-zA-Z0-9!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>\\/? ]*$' ? 'alphanumeric-symbols' :
                                                               !def.pattern ? 'none' : 'custom'}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === 'none') updateClientIdDefinition(def.id, { pattern: '', patternMessage: '' });
                                                            else if (val === 'numeric') updateClientIdDefinition(def.id, { pattern: '^[0-9]*$', patternMessage: 'Numbers only' });
                                                            else if (val === 'alphanumeric') updateClientIdDefinition(def.id, { pattern: '^[a-zA-Z0-9]*$', patternMessage: 'Letters & numbers only' });
                                                            else if (val === 'alpha') updateClientIdDefinition(def.id, { pattern: '^[a-zA-Z ]*$', patternMessage: 'Letters only' });
                                                            else if (val === 'alphanumeric-symbols') updateClientIdDefinition(def.id, { pattern: '^[a-zA-Z0-9!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>\\/? ]*$', patternMessage: 'Letters, numbers & symbols only' });
                                                        }}
                                                    >
                                                        <option value="none">Any Characters</option>
                                                        <option value="numeric">Numbers only (123)</option>
                                                        <option value="alpha">Letters only (abc)</option>
                                                        <option value="alphanumeric">Letters & Numbers (abc 123)</option>
                                                        <option value="alphanumeric-symbols">Letters, Numbers & Symbols</option>
                                                        <option value="custom">Custom Regex Pattern</option>
                                                    </Select>

                                                    {(def.pattern && !['^[0-9]*$', '^[a-zA-Z0-9]*$', '^[a-zA-Z ]*$', '^[a-zA-Z0-9!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>\\/? ]*$'].includes(def.pattern || '')) ? (
                                                        <Input
                                                            label="Custom Regex Pattern"
                                                            value={def.pattern || ''}
                                                            onChange={(e) => updateClientIdDefinition(def.id, { pattern: e.target.value })}
                                                            placeholder="e.g. ^[A-Z]{3}-\d{5}$"
                                                        />
                                                    ) : null}

                                                    <Input
                                                        label="Format Error Message"
                                                        value={def.patternMessage || ''}
                                                        onChange={(e) => updateClientIdDefinition(def.id, { patternMessage: e.target.value })}
                                                        placeholder="e.g. Invalid format"
                                                    />
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Input
                                                            label="Min Length"
                                                            type="number"
                                                            value={def.minLength || ''}
                                                            onChange={(e) => updateClientIdDefinition(def.id, { minLength: e.target.value ? parseInt(e.target.value) : undefined })}
                                                        />
                                                        <Input
                                                            label="Max Length"
                                                            type="number"
                                                            value={def.maxLength || ''}
                                                            onChange={(e) => updateClientIdDefinition(def.id, { maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                                                        />
                                                    </div>
                                                    
                                                    <div className="py-1">
                                                        <label className="flex items-center space-x-2 cursor-pointer group">
                                                            <input
                                                                type="checkbox"
                                                                checked={def.isRequiredByDefault}
                                                                onChange={(e) => updateClientIdDefinition(def.id, { isRequiredByDefault: e.target.checked })}
                                                                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                                                                Required for New Sites
                                                            </span>
                                                        </label>
                                                    </div>

                                                    <Input
                                                        label="Internal Description"
                                                        value={def.description || ''}
                                                        onChange={(e) => updateClientIdDefinition(def.id, { description: e.target.value })}
                                                        placeholder="Notes for other admins"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </section>
        )}

        {/* Workflow Section */}
        {activeTab === 'WORKFLOWS' && (
            <section>
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Approval Workflows</h2>
                    <p className="text-gray-500">Configure the review hierarchy for system requests.</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {renderWorkflow('LEAVES', 'Leave Request')}
                    {renderWorkflow('ACCOUNT_UPDATES', 'Account Update')}
                    {renderWorkflow('SUBMISSIONS', 'Joining Form')}
                    {renderWorkflow('RESIGNATIONS', 'Resignation Request')}
                </div>
            </section>
        )}
    </div>
  );
};

export default AdminWorkflowConfigPage;

