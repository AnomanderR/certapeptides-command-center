import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CertaPeptides AI Command Center",
  description: "AI-powered operations dashboard for CertaPeptides",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
