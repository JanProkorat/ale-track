export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="10" y="7" width="17" height="27" rx="3.5" fill="#F5F0E1" stroke="#1E2A3A" strokeWidth="2.4" />
      <path d="M12.4 15.5h12.2V30a2 2 0 0 1-2 2H14.4a2 2 0 0 1-2-2z" fill="#F08C00" />
      <path d="M12.4 15.5h12.2v2.6c-2 1-4 .3-6.1-.2s-4-.3-6.1.5z" fill="#FFB84D" />
      <path
        d="M11 12.5c.8-1.6 3-1.9 4.4-.9 1-1.7 3.6-1.7 4.7-.2 1.4-1 3.6-.4 4.2 1.3 1.7.2 2.5 2.2 1.4 3.4-.6.7-1.6.9-2.5.6H12.6c-1.3.3-2.6-.5-2.8-1.8-.2-1 .3-2 1.2-2.4z"
        fill="#F5F0E1"
        stroke="#1E2A3A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="27" y="14" width="4.6" height="9" rx="2.3" fill="none" stroke="#1E2A3A" strokeWidth="2.4" />
    </svg>
  );
}
