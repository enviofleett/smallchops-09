import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BudgetBallerContent {
  id: string;
  title: string;
  description?: string;
  items: any; // JSONB field from database
  background_color?: string;
  text_color?: string;
  is_active: boolean;
}

interface BudgetBallerSectionProps {
  className?: string;
}

export const BudgetBallerSection = ({ 
  className = "w-full max-w-sm"
}: BudgetBallerSectionProps) => {
  // Fetch budget baller content
  const { data: budgetBaller } = useQuery({
    queryKey: ['budget-baller-content-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_baller_content')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching budget baller content:', error);
        return null;
      }
      return data ? { ...data, items: data.items || [] } : null;
    },
  });

  // Fallback content if nothing is configured
  const defaultContent = {
    title: 'The Budget Baller',
    description: undefined,
    items: [
      { name: '5 Samosa', included: true },
      { name: '5 Spring Rolls', included: true },
      { name: '5 Stick Meat', included: true },
      { name: '20 Poff-Poff', included: true },
    ],
    background_color: '#f59e0b',
    text_color: '#1f2937',
  };

  const content = budgetBaller || defaultContent;
  const items = Array.isArray(content.items) ? content.items : defaultContent.items;
  const includedItems = items.filter((item: any) => item.included);

  return (
    <div className={className}>
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg">
        <div className="flex items-center justify-center mb-4">
          <div 
            className="px-4 sm:px-8 py-2 sm:py-3 rounded-full flex items-center space-x-2 sm:space-x-3"
            style={{ 
              background: `linear-gradient(135deg, ${content.background_color || '#f59e0b'}, ${content.background_color || '#f59e0b'}dd)`
            }}
          >
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
              </svg>
            </div>
            <h3 
              className="text-base sm:text-xl font-bold"
              style={{ color: content.text_color || '#1f2937' }}
            >
              {content.title}
            </h3>
          </div>
        </div>
        
        {content.description && (
          <p className="text-center text-sm mb-4 text-gray-700">
            {content.description}
          </p>
        )}
        
        <div className="space-y-2 sm:space-y-3">
          {includedItems.map((item, index) => (
            <span 
              key={index}
              className="text-sm text-center block pb-1 border-b border-dotted border-gray-400 text-gray-700"
            >
              {item.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};