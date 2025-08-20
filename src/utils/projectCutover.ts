// Project Cutover Utility - Safe Supabase Project Switching
// Enables switching between Supabase projects without downtime

interface ProjectConfig {
  projectId: string;
  url: string;
  anonKey: string;
  isBackup: boolean;
  isActive: boolean;
  name: string;
}

class ProjectCutoverManager {
  private primaryProject: ProjectConfig;
  private backupProject: ProjectConfig | null = null;
  private currentProject: ProjectConfig;

  constructor() {
    // Current production project
    this.primaryProject = {
      projectId: 'oknnklksdiqaifhxaccs',
      url: 'https://oknnklksdiqaifhxaccs.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA',
      isBackup: false,
      isActive: true,
      name: 'Primary Project'
    };

    this.currentProject = this.primaryProject;
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    try {
      const saved = localStorage.getItem('project_cutover_config');
      if (saved) {
        const config = JSON.parse(saved);
        if (config.backupProject) {
          this.backupProject = config.backupProject;
        }
        if (config.activeProject) {
          this.currentProject = config.activeProject;
        }
      }
    } catch (error) {
      console.warn('Failed to load cutover config:', error);
    }
  }

  private saveConfiguration(): void {
    try {
      const config = {
        backupProject: this.backupProject,
        activeProject: this.currentProject
      };
      localStorage.setItem('project_cutover_config', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save cutover config:', error);
    }
  }

  // Configure backup project
  setBackupProject(projectId: string, url: string, anonKey: string, name: string = 'Backup Project'): void {
    this.backupProject = {
      projectId,
      url,
      anonKey,
      isBackup: true,
      isActive: false,
      name
    };
    this.saveConfiguration();
    console.log(`✅ Backup project configured: ${name} (${projectId})`);
  }

  // Get current active project configuration
  getCurrentProject(): ProjectConfig {
    return this.currentProject;
  }

  // Check if backup project is available
  hasBackupProject(): boolean {
    return this.backupProject !== null;
  }

  // Perform cutover to backup project
  cutoverToBackup(): ProjectConfig | null {
    if (!this.backupProject) {
      console.error('❌ No backup project configured');
      return null;
    }

    console.log(`🔄 Cutting over from ${this.currentProject.name} to ${this.backupProject.name}`);
    
    // Mark current as inactive
    this.currentProject.isActive = false;
    
    // Switch to backup
    this.backupProject.isActive = true;
    this.currentProject = this.backupProject;
    
    this.saveConfiguration();
    
    // Set emergency mode flag for next reload
    localStorage.setItem('project_cutover_active', 'true');
    
    console.log(`✅ Cutover complete - Now using: ${this.currentProject.name}`);
    return this.currentProject;
  }

  // Revert back to primary project
  revertToPrimary(): ProjectConfig {
    console.log(`🔄 Reverting from ${this.currentProject.name} to ${this.primaryProject.name}`);
    
    this.currentProject.isActive = false;
    this.primaryProject.isActive = true;
    this.currentProject = this.primaryProject;
    
    this.saveConfiguration();
    localStorage.removeItem('project_cutover_active');
    
    console.log(`✅ Revert complete - Now using: ${this.currentProject.name}`);
    return this.currentProject;
  }

  // Generate new Supabase client configuration
  getClientConfig(): { url: string; key: string } {
    return {
      url: this.currentProject.url,
      key: this.currentProject.anonKey
    };
  }

  // Health check for current project
  async healthCheck(): Promise<{ isHealthy: boolean; projectName: string; error?: string }> {
    try {
      const response = await fetch(`${this.currentProject.url}/rest/v1/`, {
        headers: {
          'apikey': this.currentProject.anonKey,
          'Authorization': `Bearer ${this.currentProject.anonKey}`
        }
      });

      const isHealthy = response.ok;
      
      return {
        isHealthy,
        projectName: this.currentProject.name,
        error: isHealthy ? undefined : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        isHealthy: false,
        projectName: this.currentProject.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get status of all projects
  getStatus(): {
    primary: ProjectConfig & { isCurrent: boolean };
    backup: (ProjectConfig & { isCurrent: boolean }) | null;
    cutoverActive: boolean;
  } {
    return {
      primary: { ...this.primaryProject, isCurrent: this.currentProject.projectId === this.primaryProject.projectId },
      backup: this.backupProject ? { ...this.backupProject, isCurrent: this.currentProject.projectId === this.backupProject.projectId } : null,
      cutoverActive: localStorage.getItem('project_cutover_active') === 'true'
    };
  }

  // Emergency cutover (if primary is failing)
  async emergencyCutover(): Promise<boolean> {
    if (!this.hasBackupProject()) {
      console.error('❌ Emergency cutover failed - No backup project configured');
      return false;
    }

    console.warn('🚨 EMERGENCY CUTOVER INITIATED');
    
    // Check if primary is actually failing
    const primaryHealth = await this.healthCheck();
    if (primaryHealth.isHealthy && this.currentProject.projectId === this.primaryProject.projectId) {
      console.log('ℹ️ Primary project appears healthy, cutover not needed');
      return false;
    }

    // Perform cutover
    const newProject = this.cutoverToBackup();
    if (newProject) {
      // Set emergency flags
      localStorage.setItem('supabase_emergency_mode', 'true');
      localStorage.setItem('emergency_cutover_time', Date.now().toString());
      
      console.warn(`🚨 EMERGENCY CUTOVER COMPLETE - Now using: ${newProject.name}`);
      return true;
    }

    return false;
  }
}

// Singleton instance
export const projectCutover = new ProjectCutoverManager();

// Helper functions
export const getCurrentProjectConfig = () => projectCutover.getClientConfig();
export const performEmergencyCutover = () => projectCutover.emergencyCutover();
export const getProjectStatus = () => projectCutover.getStatus();
export const healthCheckCurrentProject = () => projectCutover.healthCheck();

// Auto-check for cutover flag on load
if (typeof window !== 'undefined') {
  const cutoverActive = localStorage.getItem('project_cutover_active') === 'true';
  if (cutoverActive) {
    console.warn('🔄 Project cutover is active');
  }
}