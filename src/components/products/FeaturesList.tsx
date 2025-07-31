import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

interface FeaturesListProps {
  features: string[];
  onChange: (features: string[]) => void;
  placeholder?: string;
}

export const FeaturesList = ({ features, onChange, placeholder = "Add a feature..." }: FeaturesListProps) => {
  const [newFeature, setNewFeature] = useState('');

  const addFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature.trim())) {
      onChange([...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    const updatedFeatures = features.filter((_, i) => i !== index);
    onChange(updatedFeatures);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFeature();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={newFeature}
          onChange={(e) => setNewFeature(e.target.value)}
          placeholder={placeholder}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={addFeature}
          disabled={!newFeature.trim()}
          size="sm"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {features.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {features.map((feature, index) => (
            <Badge key={index} variant="secondary" className="text-sm py-1 px-2">
              {feature}
              <button
                type="button"
                onClick={() => removeFeature(index)}
                className="ml-2 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};