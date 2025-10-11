interface RestrictedDashboardViewProps {
  userRole: string | null;
}

export const RestrictedDashboardView = ({ userRole }: RestrictedDashboardViewProps) => {

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <div className="text-6xl mb-4">😊</div>
        <p className="text-xl font-medium text-foreground">
          Ouch you cant view this page at the moment
        </p>
      </div>
    </div>
  );
};
