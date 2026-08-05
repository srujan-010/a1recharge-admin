export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Left side: Animated/Branded presentation */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        {/* Abstract background blobs */}
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="flex h-14 w-14 items-center justify-center shrink-0">
              <img src="/logo.png" alt="A1 Recharge Logo" className="h-full w-full object-contain drop-shadow-xl" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-white leading-none">A1 RECHARGE</span>
              <span className="text-[11px] font-bold text-blue-400 tracking-wider uppercase mt-1">Enterprise Admin</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-auto">
          <h1 className="mb-4 text-4xl font-bold tracking-tight">
            The Central Control Panel
          </h1>
          <p className="max-w-md text-lg text-slate-400">
            Manage your retailers, orchestrate commissions, and monitor the entire
            FinTech ecosystem in real-time.
          </p>
        </div>
      </div>

      {/* Right side: Auth Form */}
      <div className="flex flex-1 items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
