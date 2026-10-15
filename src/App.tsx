import React, { useState, useEffect } from 'react';
import PublicScanner from './components/PublicScanner.js';
import AdminPortal from './components/AdminPortal.js';

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Hidden admin portal at non-obvious route
  if (currentPath === '/osc-admin-portal' || currentPath.startsWith('/osc-admin-portal')) {
    return <AdminPortal />;
  }

  // Home page ("/") strictly shows ONLY the QR code scanner
  return <PublicScanner />;
}
