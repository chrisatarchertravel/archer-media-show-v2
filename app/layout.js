import './globals.css'

export const metadata = {
  title: 'Archer Show Control',
  description: 'Live podcast show audio control panel',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0f1117] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  )
}
