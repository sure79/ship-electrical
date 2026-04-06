import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '선박 전장기본설계 자동화',
  description: 'Ship Electrical Basic Design Automation | KR 선급 | IEC 60092',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
