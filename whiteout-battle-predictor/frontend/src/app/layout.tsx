import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Whiteout Survival — Battle Predictor',
  description: 'Battle simulation and reverse optimization engine',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
