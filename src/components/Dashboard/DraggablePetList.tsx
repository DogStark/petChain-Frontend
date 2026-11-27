import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight, PawPrint } from 'lucide-react';
import { useAnnouncement } from '@/hooks/useAnnouncement';

export interface PetListItem {
  id: string;
  name: string;
}

interface SortablePetRowProps {
  pet: PetListItem;
  index: number;
  isDragging?: boolean;
}

function SortablePetRow({ pet, index, isDragging = false }: SortablePetRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({ id: pet.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 select-none"
      aria-label={`Pet ${index + 1}: ${pet.name}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1 text-gray-300 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded cursor-grab active:cursor-grabbing"
        aria-label={`Drag to reorder ${pet.name}`}
        tabIndex={0}
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>

      {/* Pet icon */}
      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
        <PawPrint size={16} className="text-blue-500" aria-hidden="true" />
      </div>

      {/* Pet name */}
      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{pet.name}</span>

      {/* Position indicator */}
      <span className="flex-shrink-0 text-xs text-gray-400 font-medium mr-1">#{index + 1}</span>

      {/* Link */}
      <Link
        href={`/pets/${pet.id}`}
        className="flex-shrink-0 p-1 text-gray-300 hover:text-blue-500 transition-colors"
        aria-label={`View ${pet.name}'s profile`}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
    </li>
  );
}

function PetRowOverlay({ pet }: { pet: PetListItem }) {
  return (
    <div className="flex items-center gap-3 bg-white border-2 border-blue-400 rounded-xl px-4 py-3 shadow-xl opacity-95">
      <div className="flex-shrink-0 p-1 text-blue-400">
        <GripVertical size={18} />
      </div>
      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
        <PawPrint size={16} className="text-blue-500" />
      </div>
      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{pet.name}</span>
    </div>
  );
}

const ORDER_STORAGE_KEY = 'petchain_pet_list_order';

function loadSavedOrder(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveOrder(ids: string[]) {
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // quota exceeded — silently ignore
  }
}

function applyOrder(pets: PetListItem[], savedOrder: string[]): PetListItem[] {
  if (savedOrder.length === 0) return pets;
  const orderMap = new Map(savedOrder.map((id, i) => [id, i]));
  const sorted = [...pets].sort((a, b) => {
    const ia = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const ib = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
  return sorted;
}

interface Props {
  pets: PetListItem[];
}

export default function DraggablePetList({ pets }: Props) {
  const { announce } = useAnnouncement();

  const [orderedPets, setOrderedPets] = useState<PetListItem[]>(() => {
    const saved = loadSavedOrder();
    return applyOrder(pets, saved);
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Re-sync when the pets prop changes (e.g. after a fetch completes)
  useEffect(() => {
    setOrderedPets((prev) => {
      const prevIds = new Set(prev.map((p) => p.id));
      const incoming = pets.filter((p) => !prevIds.has(p.id));
      if (incoming.length === 0 && pets.length === prev.length) return prev;
      const saved = loadSavedOrder();
      return applyOrder(pets, saved);
    });
  }, [pets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || active.id === over.id) return;

      setOrderedPets((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id);
        const newIndex = prev.findIndex((p) => p.id === over.id);
        const reordered = arrayMove(prev, oldIndex, newIndex);
        saveOrder(reordered.map((p) => p.id));

        const movedPet = reordered[newIndex];
        announce(`${movedPet.name} moved to position ${newIndex + 1}`, 'success');

        return reordered;
      });
    },
    [announce]
  );

  const activePet = activeId ? orderedPets.find((p) => p.id === activeId) ?? null : null;

  if (orderedPets.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        <PawPrint size={28} className="mx-auto mb-2 text-gray-300" />
        No pets to display.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={orderedPets.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2" aria-label="Your pets (drag to reorder)">
          {orderedPets.map((pet, index) => (
            <SortablePetRow key={pet.id} pet={pet} index={index} />
          ))}
        </ul>
      </SortableContext>

      <DragOverlay>
        {activePet ? <PetRowOverlay pet={activePet} /> : null}
      </DragOverlay>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Drag <GripVertical size={12} className="inline -mt-0.5" /> to reorder. Order is saved automatically.
      </p>
    </DndContext>
  );
}
