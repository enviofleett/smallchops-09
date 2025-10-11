import { Card, CardContent } from '@/components/ui/card';

interface RestrictedDashboardViewProps {
  userRole: string | null;
}

export const RestrictedDashboardView = ({ userRole }: RestrictedDashboardViewProps) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="text-6xl mb-4">😊</div>
            <p className="text-xl font-medium text-foreground">
              Ouch you can&apos;t view this page at the moment
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
