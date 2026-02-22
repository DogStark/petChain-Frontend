//import Header from '@/components/Header';
export default function HeaderComponent() {
  return (
    <header className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">PetChain</h1>
        <nav>
          <ul className="flex space-x-4">
            <li><a href="/" className="hover:text-blue-200">Home</a></li>
            <li><a href="/search" className="hover:text-blue-200">Search</a></li>
            <li><a href="/dental" className="hover:text-blue-200 flex items-center gap-1">🦷 Dental</a></li>
            <li><a href="#" className="hover:text-blue-200">About</a></li>
            <li><a href="#" className="hover:text-blue-200">Contact</a></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}