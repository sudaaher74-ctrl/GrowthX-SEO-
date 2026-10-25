import React from "react";

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

export function GooglePlacesLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl border border-brand-200/80 bg-white ${className}`}>
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill="#EA4335"
        />
        <circle cx="12" cy="9" r="3" fill="white" />
        <circle cx="12" cy="9" r="1.5" fill="#4285F4" />
      </svg>
    </div>
  );
}

export function GoogleGLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export function GmailLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M2 5.5V18.5C2 19.33 2.67 20 3.5 20H6V11.5L12 16L18 11.5V20H20.5C21.33 20 22 19.33 22 18.5V5.5C22 4.3 20.63 3.6 19.7 4.3L12 10.2L4.3 4.3C3.37 3.6 2 4.3 2 5.5Z"
        fill="#EA4335"
      />
      <path d="M18 20V11.5L22 8.5V18.5C22 19.33 21.33 20 20.5 20H18Z" fill="#C5221F" />
      <path d="M6 20V11.5L2 8.5V18.5C2 19.33 2.67 20 3.5 20H6Z" fill="#FBBC05" />
      <path d="M2 5.5C2 4.3 3.37 3.6 4.3 4.3L12 10.2L6 14.5L2 11.5V5.5Z" fill="#34A853" />
      <path d="M22 5.5C22 4.3 20.63 3.6 19.7 4.3L12 10.2L18 14.5L22 11.5V5.5Z" fill="#4285F4" />
    </svg>
  );
}
