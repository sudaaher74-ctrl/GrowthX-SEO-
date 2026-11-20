import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client Performance Report",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function SharedReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
