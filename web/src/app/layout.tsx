import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"
import "./globals.css"
import Providers from "./providers"

const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Anima — Knowledge Base",
  description: "Collective knowledge base powered by AI",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <body className="bg-zinc-950 text-zinc-100 min-h-screen font-mono">
        <Providers>
          <nav className="border-b border-zinc-800 px-6 py-3 flex gap-6 items-center">
            <span className="font-bold text-white">anima</span>
            <a href="/chat" className="text-zinc-400 hover:text-white text-sm">chat</a>
            <a href="/pending" className="text-zinc-400 hover:text-white text-sm">pending</a>
            <a href="/docs" className="text-zinc-400 hover:text-white text-sm">docs</a>
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  )
}
