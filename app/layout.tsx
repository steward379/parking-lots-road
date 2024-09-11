import type { Metadata } from 'next';
import { ThemeProvider } from "./../components/theme-provider";
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
    title: "",
    description: "",
    icons: {
        icon: "/favicon.ico",
        shortcut: "/favicon.ico",
        apple: "/favicon.ico",
    },
};

export default function RootLayout({ children }: any) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="bg-white min-h-screen">
                <ThemeProvider attribute="class" defaultTheme="light">
                    <main className="min-h-screen flex flex-col">{children}</main>
                </ThemeProvider>
            </body>
        </html>
    );
}