import { useState } from 'react';
import { Info } from 'lucide-react';

interface DeploymentInfoProps {
  buildTime?: string;
  commitHash?: string;
  version?: string;
}

export const DeploymentInfo = ({ 
  buildTime = new Date().toISOString(), 
  commitHash = 'local-dev',
  version = '1.1.1'
}: DeploymentInfoProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show in footer on non-development environments
  if (window.location.hostname.includes('localhost')) {
    return null;
  }

  const shortCommit = commitHash.substring(0, 7);
  const buildDate = new Date(buildTime).toLocaleString();

  return (
    <div className="fixed bottom-2 right-2 z-50">
      <div className="bg-muted/80 backdrop-blur-sm border border-border rounded-lg p-2 text-xs">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="h-3 w-3" />
          <span>v{version}</span>
        </button>
        
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-border space-y-1 min-w-48">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Build:</span>
              <span className="font-mono">{buildDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Commit:</span>
              <span className="font-mono">{shortCommit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Domain:</span>
              <span className="font-mono text-xs">{window.location.hostname}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};