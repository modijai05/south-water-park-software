import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { useAuthStore } from '@/store/authStore';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showAdminLink?: boolean;
}

export function Layout({ children, title }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(dayjs());

  // Keyboard shortcuts for desktop
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts on desktop (not mobile)
      if (window.innerWidth < 1024) return;
      
      // Ctrl/Cmd + K for quick navigation
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        // Quick navigation logic could go here
      }
      
      // Ctrl/Cmd + / for help
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault();
        // Help modal could go here
      }
      
      // Escape to go back
      if (event.key === 'Escape') {
        if (location.pathname !== '/admin' && location.pathname !== '/staff') {
          navigate(user?.role === 'admin' ? '/admin' : '/staff');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location.pathname, user?.role]);
  
  // Add global styles for animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .animate-slide-in {
        animation: slideInRight 0.3s ease-out;
      }
      
      .animate-slide-out {
        animation: slideOutRight 0.3s ease-out;
      }
      
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (style && style.parentNode === document.head) {
        document.head.removeChild(style);
      }
    };
  }, []);

  // Optimize time updates - update every 30 seconds instead of every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs()), 30000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminLinks = [
    { label: '📊 Dashboard', path: '/admin' },
    { label: '📋 Entries', path: '/admin/entries' },
    { label: '👥 Users', path: '/admin/users' },
    { label: '🎫 Ticket Config', path: '/admin/ticket-config' },
    { label: '📦 Export', path: '/admin/export' },
  ];

  const staffLinks = [
    { label: '📋 My Dashboard', path: '/staff' },
    { label: '🎫 Fill Ticket', path: '/ticket' },
  ];

  const links = user?.role === 'admin' ? adminLinks : staffLinks;
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="layout-bg text-blue-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute top-40 right-20 w-24 h-24 bg-blue-300/30 rounded-full blur-xl"
          animate={{ 
            x: [0, -80, 0], 
            y: [0, 60, 0], 
            scale: [1, 0.8, 1] 
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-20 left-1/3 w-40 h-40 bg-blue-100/20 rounded-full blur-2xl"
          animate={{ 
            x: [0, 60, 0], 
            y: [0, -30, 0], 
            scale: [1, 1.3, 1] 
          }}
          transition={{ duration: 12, repeat: Infinity }}
        />
      </div>

      <header className="header-modern">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
          <motion.div 
            className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 sm:gap-4"
            >
              {/* Logo */}
              <Link
                to={user?.role === 'admin' ? '/admin' : '/staff'}
                className="block hover:opacity-80 transition"
              >
                <motion.img
                  src="/The South Water Park Logo.png"
                  alt="South Water Park Logo"
                  className="w-12 h-12 sm:w-20 sm:h-20 object-contain"
                  animate={{ 
                    rotate: [0, 1, -1, 0],
                    scale: [1, 1.02, 1]
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity 
                  }}
                  whileHover={{ 
                    scale: 1.05,
                    filter: "drop-shadow(0 4px 8px rgba(59, 130, 246, 0.3))"
                  }}
                />
              </Link>
              
              {/* Heading */}
              <Link 
                to={user?.role === 'admin' ? '/admin' : '/staff'} 
                className="heading-lg text-xl sm:text-3xl lg:text-4xl !m-0 hover:opacity-80 transition text-center"
              >
                <div className="bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900 bg-clip-text text-transparent font-black">
                  THE SOUTH WATER PARK
                </div>
                <div className="text-sm sm:text-base lg:text-lg text-blue-800 font-bold mt-1">
                  Ticket Management System
                </div>
              </Link>
            </motion.div>
            <motion.div 
              className="flex flex-col items-end gap-2 w-full sm:w-auto"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-right">
                  {user?.fullName && (
                    <p className="text-xs sm:text-sm font-medium text-blue-800 hidden sm:block">
                      👨‍💼 {user.fullName}
                    </p>
                  )}
                  <p className="text-xs sm:text-sm font-medium text-blue-700">
                    👤 {user?.username}
                  </p>
                  <p className="text-xs text-blue-600">
                    {user?.role === 'admin' ? '👑 Admin' : '👨 Staff'}
                  </p>
                </div>
                <motion.button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-2 sm:px-6 sm:py-3 rounded-xl bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 text-red-700 font-bold text-xs sm:text-sm transition border-2 border-red-200 hover:border-red-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  🚪 <span className="hidden sm:inline">Logout</span>
                </motion.button>
              </div>
              <motion.div
                className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 px-3 py-2 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl shadow-xl border-2 border-blue-500"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <p className="text-lg sm:text-2xl font-black text-white">
                  {currentTime.format('hh:mm A')}
                </p>
                <p className="text-xs font-bold text-cyan-300">
                  {currentTime.format('dddd')}
                </p>
                <p className="text-sm font-bold text-white">
                  {currentTime.format('MMMM D, YYYY')}
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
          <motion.nav 
            className="flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-start"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {links.map((link, index) => (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  to={link.path}
                  className={`nav-link ${isActive(link.path) ? 'active' : ''}`}
                >
                  <span className="text-xs sm:text-sm">{link.label}</span>
                </Link>
              </motion.div>
            ))}
          </motion.nav>
        </div>
      </header>
      <main className="max-w-7xl xl:max-w-8xl 2xl:max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 relative z-10">
        {title && (
          <motion.h1
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="heading-xl mb-12 text-center"
          >
            {title}
          </motion.h1>
        )}
        {children}
      </main>
    </div>
  );
}
