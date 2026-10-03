export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg viewBox="0 0 24 24" className="size-5 text-accent" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Z" />
        <circle cx="12" cy="11" r="3" />
        <path d="M12 8v-2M12 16v-2M9 11H7M17 11h-2" />
      </svg>
      SentinelLab
    </span>
  );
}
