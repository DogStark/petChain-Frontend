//import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function HeaderComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await logout();
    }
  };

  return (
    <header className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          <Link href="/" className="hover:text-blue-200">
            PetChain
          </Link>
        </h1>
        <nav>
          <ul className="flex space-x-4 items-center">
            <li><Link href="/" className="hover:text-blue-200">Home</Link></li>
            <li><Link href="/search" className="hover:text-blue-200">Search</Link></li>
            <li><Link href="/dental" className="hover:text-blue-200 flex items-center gap-1">🦷 Dental</Link></li>
            
            {isAuthenticated ? (
              <>
                <li><Link href="/dashboard" className="hover:text-blue-200">Dashboard</Link></li>
                <li><Link href="/sessions" className="hover:text-blue-200">Sessions</Link></li>
                <li className="text-blue-200">Welcome, {user?.firstName}!</li>
                <li>
                  <button 
                    onClick={handleLogout}
                    className="hover:text-blue-200 bg-blue-700 px-3 py-1 rounded"
                  >
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <>
                <li><Link href="/login" className="hover:text-blue-200">Login</Link></li>
                <li>
                  <Link 
                    href="/register" 
                    className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded"
                  >
                    Register
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}