import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Settings } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api/apiBaseUrl';

export type PetPermissionLevel = 'owner' | 'editor' | 'viewer';

export interface PetSharingMember {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  permission: PetPermissionLevel;
}

interface PetSharingSummaryProps {
  petId: string;
  members?: PetSharingMember[];
}

const API_BASE_URL = getApiBaseUrl();

const PERMISSION_LABELS: Record<PetPermissionLevel, string> = {
  owner: 'Owner',
  editor: 'Can edit',
  viewer: 'Can view',
};

const PERMISSION_STYLES: Record<PetPermissionLevel, string> = {
  owner: 'bg-purple-100 text-purple-800',
  editor: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-700',
};

export default function PetSharingSummary({ petId, members }: PetSharingSummaryProps) {
  const [sharingMembers, setSharingMembers] = useState<PetSharingMember[]>(members ?? []);
  const [isLoading, setIsLoading] = useState(!members);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (members) {
      setSharingMembers(members);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const fetchMembers = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem('authToken');
        const res = await fetch(`${API_BASE_URL}/pets/${petId}/sharing`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error('Failed to load sharing summary');
        }

        const data = await res.json();
        if (cancelled) return;
        setSharingMembers(Array.isArray(data) ? data : data.members ?? []);
      } catch (err: unknown) {
        if (cancelled || (err as { name?: string })?.name === 'AbortError') return;
        setError((err as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchMembers();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [petId, members]);

  return (
    <section aria-labelledby="pet-sharing-title">
      <div className="flex items-center justify-between mb-4">
        <h2 id="pet-sharing-title" className="flex items-center gap-2 text-lg font-semibold">
          <Users size={18} />
          Sharing
        </h2>
        <Link
          href={`/pets/${petId}/sharing`}
          className="flex items-center gap-2 text-sm bg-gray-900 text-white px-4 py-2 rounded-full hover:bg-gray-700 transition-all"
        >
          <Settings size={14} /> Manage Sharing
        </Link>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading sharing summary...</p>}

      {!isLoading && error && <p className="text-sm text-red-600">{error}</p>}

      {!isLoading && !error && sharingMembers.length === 0 && (
        <p className="text-sm text-gray-500">No household members have access yet.</p>
      )}

      {!isLoading && !error && sharingMembers.length > 0 && (
        <ul className="divide-y divide-gray-100" aria-label="Household members with pet access">
          {sharingMembers.map((member) => (
            <li key={member.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600"
                  >
                    {member.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  {member.email && <p className="text-xs text-gray-500">{member.email}</p>}
                </div>
              </div>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${PERMISSION_STYLES[member.permission]}`}
              >
                {PERMISSION_LABELS[member.permission]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
