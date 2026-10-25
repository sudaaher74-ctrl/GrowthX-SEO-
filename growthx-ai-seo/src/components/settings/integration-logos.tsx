import React from "react";

export function WordPressLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-brand-200/80 bg-white ${className}`}>
      <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="17" fill="#21759B" />
        <path
          d="M20 5C11.716 5 5 11.716 5 20c0 3.754 1.385 7.185 3.684 9.824L17.26 14.74c.48-1.314.93-2.253.93-3.14 0-.48-.12-.84-.24-1.2A14.945 14.945 0 0 1 20 5zm11.316 24.824A14.94 14.94 0 0 0 35 20c0-3.938-1.523-7.52-4.01-10.203-.09.77-.18 1.577-.18 2.454 0 1.542.427 3.32.846 4.966l3.66 12.607zM20 35c-2.454 0-4.757-.594-6.786-1.646l6.233-18.093 6.386 17.51C24.088 34.258 22.095 35 20 35zM7.16 22.37A14.887 14.887 0 0 0 11.83 32.22L6.15 15.65c-.71 2.05-1.15 4.31-1.15 6.72h2.16z"
          fill="white"
        />
      </svg>
    </div>
  );
}

export function WebflowLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-brand-200/80 bg-white ${className}`}>
      <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
        <path
          d="M31 13l-4.8 14h-4.3l-3.2-9.1-3.2 9.1h-4.3L6.4 13h4.8l2.7 8.6 3-8.6h3.6l3 8.6 2.7-8.6H31z"
          fill="#146EF5"
        />
      </svg>
    </div>
  );
}

export function FramerLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-brand-200/80 bg-white ${className}`}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
        <path d="M4 0h16v8h-8l8 8H4v-8h8L4 0z" fill="#0055FF" />
        <path d="M4 16h8l-8 8v-8z" fill="#0055FF" />
      </svg>
    </div>
  );
}

export function WixLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-brand-200/80 bg-white ${className}`}>
      <span className="font-sans text-sm font-black tracking-tight text-brand-950">
        WiX
      </span>
    </div>
  );
}

export function SanityLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl bg-[#101112] ${className}`}>
      <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
        <path
          d="M13 25.5L24.5 14H27L15.5 25.5H13zM15 14h2.5l9.5 9.5H24.5L15 14z"
          fill="#F03E2F"
        />
        <circle cx="15" cy="16" r="1.5" fill="#F03E2F" />
      </svg>
    </div>
  );
}

export function HubSpotLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-brand-200/80 bg-white ${className}`}>
      <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
        <circle cx="27" cy="15" r="3" fill="#FF7A59" />
        <circle cx="15" cy="20" r="4.5" fill="#FF7A59" />
        <circle cx="27" cy="25" r="2.5" fill="#FF7A59" />
        <path d="M18 20h6v-3.5" stroke="#FF7A59" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M20 20v4.5h4.5" stroke="#FF7A59" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function GitHubLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-brand-200/80 bg-white ${className}`}>
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          fill="#24292F"
        />
      </svg>
    </div>
  );
}

export function TwitterXLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-brand-200/80 bg-white ${className}`}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
        <path
          d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
          fill="#000000"
        />
      </svg>
    </div>
  );
}

export function LinkedInLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl bg-[#0A66C2] ${className}`}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
        <path
          d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.46 1.46 0 1 0 0-2.92 1.46 1.46 0 0 0 0 2.92M7.86 18.5v-8.37H5.07v8.37h2.79z"
          fill="white"
        />
      </svg>
    </div>
  );
}

export function GoogleAnalyticsLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-brand-200/80 bg-white ${className}`}>
      <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
        <rect x="11" y="22" width="4.5" height="7" rx="2.25" fill="#F9AB00" />
        <rect x="17.75" y="16" width="4.5" height="13" rx="2.25" fill="#E37400" />
        <rect x="24.5" y="10" width="4.5" height="19" rx="2.25" fill="#E37400" />
      </svg>
    </div>
  );
}

export function GoogleSearchConsoleLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-brand-200/80 bg-white ${className}`}>
      <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
        <path d="M13 27l5-6 4 3.5 5-8" stroke="#4285F4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="27" cy="16.5" r="2.2" fill="#34A853" />
        <circle cx="22" cy="24.5" r="2.2" fill="#FBBC05" />
        <circle cx="18" cy="21" r="2.2" fill="#EA4335" />
      </svg>
    </div>
  );
}

export function SlackLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-brand-200/80 bg-white ${className}`}>
      <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
        <circle cx="16" cy="14" r="2" fill="#E01E5A" />
        <circle cx="26" cy="16" r="2" fill="#36C5F0" />
        <circle cx="24" cy="26" r="2" fill="#2EB67D" />
        <circle cx="14" cy="24" r="2" fill="#ECB22E" />
        <path d="M19 13v14M13 19h14" stroke="#4A154B" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function DiscordLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl bg-[#5865F2] ${className}`}>
      <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none">
        <path
          d="M26.2 14.5c-1.2-.5-2.4-.9-3.7-1.1-.2.3-.3.7-.5 1-1.3-.2-2.7-.2-4 0-.2-.3-.4-.7-.5-1-1.3.2-2.5.6-3.7 1.1-2.3 3.5-3 6.9-2.7 10.3 1.5 1.1 3 1.8 4.5 2.3.4-.5.7-1.1 1-1.7-1-.4-1.4-.9-1.8-1.5.1-.1.2-.1.3-.2 2.9 1.3 6 1.3 8.8 0 .1.1.2.1.3.2-.4.6-.9 1.1-1.8 1.5.3.6.6 1.2 1 1.7 1.5-.5 3-1.2 4.5-2.3.4-4-.7-7.4-2.7-10.3zM16.5 21.5c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8c0 1-.7 1.8-1.6 1.8zm7 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8c0 1-.7 1.8-1.6 1.8z"
          fill="white"
        />
      </svg>
    </div>
  );
}
