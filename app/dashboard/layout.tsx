export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F4F7FE] text-slate-800 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}