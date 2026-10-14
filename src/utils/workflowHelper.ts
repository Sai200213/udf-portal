import { Site, StaffUser, WorkflowConfig, ApprovalLevel, Role, Permission } from '../../types';

/**
 * Checks if a specific role is assigned to supervise a site or has global approval authority.
 */
export function isRoleAssignedToSite(
  roleId: string,
  site: Site | undefined,
  staffUsers: StaffUser[],
  roles?: Role[]
): boolean {
  if (!site) return false;
  
  // 1. Check if the role itself has company-wide scope permission in the Roles & Permissions tab
  if (roles && roles.length > 0) {
    const roleObj = roles.find(r => r.id === roleId);
    if (roleObj && !roleObj.isDisabled) {
      const hasGlobalScope = roleObj.permissions?.includes(Permission.SUBMISSIONS_VIEW_SCOPE_ALL) ||
        roleObj.permissions?.includes(Permission.EMPLOYEES_VIEW_SCOPE_ALL) ||
        roleObj.permissions?.includes(Permission.LEAVES_VIEW_SCOPE_ALL) ||
        roleObj.permissions?.includes(Permission.ACCOUNT_UPDATES_VIEW_SCOPE_ALL) ||
        roleObj.permissions?.includes(Permission.RESIGNATIONS_VIEW_SCOPE_ALL);
      if (hasGlobalScope) {
        return true;
      }
    }
  }

  // 2. Check if any staff user with this role is assigned to this site, OR is an all-sites staff member
  return staffUsers.some(u => {
    if (u.roleId !== roleId || u.isDisabled) return false;

    // Explicitly supervising or managing this site
    if (site.supervisorId === u.id || (u.sitesManaged && u.sitesManaged.includes(site.id))) {
      return true;
    }

    return false;
  });
}

/**
 * Calculates the effective approval level for a request.
 * If a lower workflow level has no role assigned to the site, 
 * it checks the next level, and so on.
 */
export function getEffectiveApprovalLevel(
  currentLevel: number,
  site: Site | undefined,
  config: WorkflowConfig | undefined,
  staffUsers: StaffUser[],
  roles?: Role[]
): number {
  if (!config || !config.levels || config.levels.length === 0) {
    return currentLevel;
  }

  const sortedLevels = [...config.levels].sort((a, b) => a.level - b.level);
  const maxLevel = sortedLevels[sortedLevels.length - 1].level;

  if (currentLevel > maxLevel) {
    return currentLevel;
  }

  let level = currentLevel;

  while (level < maxLevel) {
    const levelConfig = sortedLevels.find(l => l.level === level);
    if (!levelConfig) {
      level++;
      continue;
    }

    // Check if there is any staff user supervising the site with this level's role or with global scope
    const isAssigned = isRoleAssignedToSite(levelConfig.roleId, site, staffUsers, roles);
    if (isAssigned) {
      return level;
    }

    // If not assigned, skip/escalate to the next level
    level++;
  }

  // Fallback to the final level if no intermediate levels are assigned
  return maxLevel;
}
