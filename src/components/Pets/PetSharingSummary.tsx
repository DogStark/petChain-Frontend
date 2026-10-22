import { useCallback, useEffect, useState } from 'react';

import { petAPI, type PetShareSummary } from '@/lib/api/petAPI';

interface SharedPet {
  id: string;
  name: string;
}

interface ShareList {
  pet: SharedPet;
  shares: PetShareSummary[];
  error?: string;
}

export default function PetSharingSummary({ pets }: { pets: SharedPet[] }) {
  const [shareLists, setShareLists] = useState<ShareList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadShares = useCallback(async () => {
    setIsLoading(true);
    const results = await Promise.all(
      pets.map(async (pet): Promise<ShareList> => {
        try {
          return { pet, shares: await petAPI.getPetShares(pet.id) };
        } catch (error) {
          return {
            pet,
            shares: [],
            error: error instanceof Error ? error.message : 'Unable to load sharing details.',
          };
        }
      })
    );
    setShareLists(results);
    setIsLoading(false);
  }, [pets]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  return (
    <section className="mt-8 rounded-lg bg-white shadow" aria-labelledby="pet-sharing-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
        <div>
          <h2 id="pet-sharing-title" className="text-lg font-medium text-gray-900">
            Shared-pet permissions
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Review household access for your pets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadShares()}
          disabled={isLoading}
          className="text-sm font-medium text-blue-700 underline disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      <div className="space-y-5 px-6 py-4">
        {isLoading ? (
          <p className="text-sm text-gray-600" role="status">Loading shared access…</p>
        ) : pets.length === 0 ? (
          <p className="text-sm text-gray-600">Add a pet to manage shared access.</p>
        ) : (
          shareLists.map(({ pet, shares, error }) => (
            <div key={pet.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-semibold text-gray-900">{pet.name}</h3>
              {error ? (
                <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>
              ) : shares.length === 0 ? (
                <p className="mt-2 text-sm text-gray-600">No household members currently have access.</p>
              ) : (
                <ul className="mt-2 divide-y divide-gray-100">
                  {shares.map((share) => {
                    const memberName = [share.sharedWithUser?.firstName, share.sharedWithUser?.lastName]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <li key={share.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span className="text-gray-800">
                          {memberName ||
                            share.sharedWithUser?.email ||
                            `Member ${share.sharedWithUserId.slice(0, 8)}`}
                          {memberName && share.sharedWithUser?.email && (
                            <span className="ml-2 text-gray-500">{share.sharedWithUser.email}</span>
                          )}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {share.canEdit ? 'Can view and edit' : 'View only'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))
        )}
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Pending invitations are not available from the current pet-sharing service. No invitation
          tokens are loaded or rendered here.
        </div>
      </div>
    </section>
  );
}
