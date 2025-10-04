import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Check, X } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

interface PasswordRequirement {
  label: string;
  met: boolean;
}

export function PasswordStrengthIndicator({ password, showRequirements = true }: PasswordStrengthIndicatorProps) {
  const analysis = useMemo(() => {
    const requirements: PasswordRequirement[] = [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
      { label: 'Contains number', met: /\d/.test(password) },
      { label: 'Contains special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];

    const metCount = requirements.filter(r => r.met).length;
    const strength = metCount === 0 ? 0 : (metCount / requirements.length) * 100;
    
    let strengthLabel = 'Weak';
    let strengthColor = 'text-red-500';
    
    if (metCount >= 5) {
      strengthLabel = 'Very Strong';
      strengthColor = 'text-green-600';
    } else if (metCount >= 4) {
      strengthLabel = 'Strong';
      strengthColor = 'text-green-500';
    } else if (metCount >= 3) {
      strengthLabel = 'Moderate';
      strengthColor = 'text-yellow-500';
    }

    return {
      requirements,
      strength,
      strengthLabel,
      strengthColor,
      metCount,
    };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Password strength</span>
          <span className={`text-sm font-medium ${analysis.strengthColor}`}>
            {analysis.strengthLabel}
          </span>
        </div>
        <Progress 
          value={analysis.strength} 
          className={`h-2 ${
            analysis.metCount >= 4 ? 'bg-green-100' : 
            analysis.metCount >= 3 ? 'bg-yellow-100' : 
            'bg-red-100'
          }`}
        />
      </div>

      {showRequirements && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Requirements:</p>
          {analysis.requirements.map((req, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              {req.met ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <X className="h-3.5 w-3.5 text-red-400" />
              )}
              <span className={req.met ? 'text-green-600' : 'text-muted-foreground'}>
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
