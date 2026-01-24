import { useState } from 'react';
import SearchBar, { SearchFilters } from '../components/SearchBar';
import SearchResults from '../components/SearchResults';

interface Pet {
  id: string;
  name: string;
  breed: string;
  species: string;
  age: number;
  location: string;
  status: string;
  owner: {
    firstName: string;
    lastName: string;
  };
}

interface Vet {
  id: string;
  name: string;
  specialty: string;
  clinicName: string;
  location: string;
  rating: number;
  yearsOfExperience: number;
}

interface MedicalRecord {
  id: string;
  condition: string;
  treatment: string;
  recordDate: string;
  vetName: string;
  pet: {
    name: string;
    breed: string;
  };
}

interface EmergencyService {
  id: string;
  name: string;
  serviceType: string;
  location: string;
  is24Hours: boolean;
  rating: number;
  phone: string;
}

type SearchType = 'pets' | 'vets' | 'medical-records' | 'emergency-services' | 'global';

export default function SearchPage() {
  const [searchType, setSearchType] = useState<SearchType>('global');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({});

  const handleSearch = async (query: string, filters: SearchFilters, page = 1) => {
    setIsLoading(true);
    setCurrentQuery(query);
    setCurrentFilters(filters);

    try {
      const params = new URLSearchParams({
        query: query || '',
        page: page.toString(),
        limit: '10',
        ...Object.entries(filters).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            acc[key] = value.toString();
          }
          return acc;
        }, {} as Record<string, string>),
      });

      const endpoint = searchType === 'global' 
        ? '/api/v1/search/global'
        : `/api/v1/search/${searchType}`;

      const response = await fetch(`${endpoint}?${params}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    handleSearch(currentQuery, currentFilters, page);
  };

  const renderPetCard = (pet: Pet) => (
    <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{pet.name}</h3>
          <p className="text-sm text-gray-600">
            {pet.breed} • {pet.species} • {pet.age} years old
          </p>
          <p className="text-sm text-gray-500 mt-1">
            📍 {pet.location}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Owner: {pet.owner.firstName} {pet.owner.lastName}
          </p>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
          pet.status === 'active' ? 'bg-green-100 text-green-800' : 
          pet.status === 'missing' ? 'bg-red-100 text-red-800' : 
          'bg-gray-100 text-gray-800'
        }`}>
          {pet.status}
        </span>
      </div>
    </div>
  );

  const renderVetCard = (vet: Vet) => (
    <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{vet.name}</h3>
          <p className="text-sm text-gray-600">{vet.specialty}</p>
          <p className="text-sm text-gray-500 mt-1">
            🏥 {vet.clinicName}
          </p>
          <p className="text-sm text-gray-500">
            📍 {vet.location}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {vet.yearsOfExperience} years experience
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            <span className="text-yellow-500">⭐</span>
            <span className="font-semibold">{vet.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMedicalRecordCard = (record: MedicalRecord) => (
    <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
      <div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{record.condition}</h3>
          <span className="text-xs text-gray-500">
            {new Date(record.recordDate).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          Treatment: {record.treatment}
        </p>
        <p className="text-sm text-gray-500">
          Pet: {record.pet.name} ({record.pet.breed})
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Vet: {record.vetName}
        </p>
      </div>
    </div>
  );

  const renderEmergencyServiceCard = (service: EmergencyService) => (
    <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
            {service.is24Hours && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                24/7
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">{service.serviceType}</p>
          <p className="text-sm text-gray-500 mt-1">
            📍 {service.location}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            📞 {service.phone}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            <span className="text-yellow-500">⭐</span>
            <span className="font-semibold">{service.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGlobalResults = () => {
    if (!searchResults) return null;

    return (
      <div className="space-y-8">
        {searchResults.pets?.results?.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Pets ({searchResults.pets.total})</h2>
            <div className="space-y-3">
              {searchResults.pets.results.map((pet: Pet) => (
                <div key={pet.id}>{renderPetCard(pet)}</div>
              ))}
            </div>
          </div>
        )}

        {searchResults.vets?.results?.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Vets ({searchResults.vets.total})</h2>
            <div className="space-y-3">
              {searchResults.vets.results.map((vet: Vet) => (
                <div key={vet.id}>{renderVetCard(vet)}</div>
              ))}
            </div>
          </div>
        )}

        {searchResults.medicalRecords?.results?.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Medical Records ({searchResults.medicalRecords.total})</h2>
            <div className="space-y-3">
              {searchResults.medicalRecords.results.map((record: MedicalRecord) => (
                <div key={record.id}>{renderMedicalRecordCard(record)}</div>
              ))}
            </div>
          </div>
        )}

        {searchResults.emergencyServices?.results?.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Emergency Services ({searchResults.emergencyServices.total})</h2>
            <div className="space-y-3">
              {searchResults.emergencyServices.results.map((service: EmergencyService) => (
                <div key={service.id}>{renderEmergencyServiceCard(service)}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getRenderer = () => {
    switch (searchType) {
      case 'pets':
        return renderPetCard;
      case 'vets':
        return renderVetCard;
      case 'medical-records':
        return renderMedicalRecordCard;
      case 'emergency-services':
        return renderEmergencyServiceCard;
      default:
        return () => null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Search PetChain</h1>
          <p className="text-gray-600">Find pets, vets, medical records, and emergency services</p>
        </div>

        {/* Search Type Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { value: 'global', label: 'All' },
              { value: 'pets', label: 'Pets' },
              { value: 'vets', label: 'Vets' },
              { value: 'medical-records', label: 'Medical Records' },
              { value: 'emergency-services', label: 'Emergency' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setSearchType(tab.value as SearchType);
                  setSearchResults(null);
                }}
                className={`px-6 py-2 font-semibold rounded-lg whitespace-nowrap transition-colors ${
                  searchType === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <SearchBar
            onSearch={handleSearch}
            placeholder={`Search ${searchType === 'global' ? 'everything' : searchType}...`}
            showFilters={true}
            searchType={searchType}
          />
        </div>

        {/* Results */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {searchType === 'global' ? (
            isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : searchResults ? (
              renderGlobalResults()
            ) : (
              <div className="text-center py-12 text-gray-500">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="text-lg">Start searching to see results</p>
              </div>
            )
          ) : (
            <SearchResults
              results={searchResults?.results || []}
              total={searchResults?.total || 0}
              page={searchResults?.page || 1}
              limit={searchResults?.limit || 10}
              totalPages={searchResults?.totalPages || 0}
              searchTime={searchResults?.searchTime || 0}
              isLoading={isLoading}
              onPageChange={handlePageChange}
              renderItem={getRenderer()}
              emptyMessage={searchResults ? `No ${searchType} found` : 'Start searching to see results'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
