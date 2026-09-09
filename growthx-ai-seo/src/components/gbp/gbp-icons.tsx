import React from "react";

/**
 * Google Business Profile official-style Storefront icon
 * Blue rounded badge with storefront awning and white Google G mark
 */
export function GbpStoreIcon({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#2563EB" />
      {/* Storefront awning */}
      <path
        d="M12 20V17C12 15.3431 13.3431 14 15 14H33C34.6569 14 36 15.3431 36 17V20"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M10 20H38L36 24C35.5 25 34 26 32.5 26C31 26 29.5 25 29 24C28.5 25 27 26 25.5 26C24 26 22.5 25 22 24C21.5 25 20 26 18.5 26C17 26 15.5 25 15 24L10 20Z"
        fill="white"
        fillOpacity="0.3"
      />
      {/* Google 'G' letterform in center */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24 22C28.4183 22 32 25.5817 32 30C32 34.4183 28.4183 38 24 38C19.5817 38 16 34.4183 16 30C16 25.5817 19.5817 22 24 22ZM24 25C21.2386 25 19 27.2386 19 30C19 32.7614 21.2386 35 24 35C26.7614 35 29 32.7614 29 30C29 28.8 28.5 27.8 27.7 27.1L27.7 30H24V28H29.3C29.1 27.2 28.6 26.5 28 26C26.9 25.4 25.5 25 24 25Z"
        fill="white"
      />
    </svg>
  );
}

/**
 * Google 'G' 4-color iconic logo
 */
export function GoogleGLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}
