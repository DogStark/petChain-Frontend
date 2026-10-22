import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AllergyConflictWarning } from '../AllergyConflictWarning';
import type { AllergyRecord } from '../../../types/records';

const allergies: AllergyRecord[] = [
  {
    id: 'allergy-1',
    petId: 'pet-1',
    allergen: 'Penicillin',
    reaction: 'Anaphylaxis',
    severity: 'severe',
    recordedAt: '2024-01-10T00:00:00.000Z',
  },
  {
    id: 'allergy-2',
    petId: 'pet-1',
    allergen: 'Chicken',
    reaction: 'Itching',
    severity: 'mild',
    recordedAt: '2024-02-01T00:00:00.000Z',
  },
];

describe('AllergyConflictWarning', () => {
  it('renders nothing when there are no conflicts', () => {
    const { container } = render(
      <AllergyConflictWarning
        conflicts={[]}
        onOverride={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('warns and links to the source allergy record on conflict', () => {
    render(
      <AllergyConflictWarning
        conflicts={[{ allergy: allergies[0], matchedTerm: 'Penicillin' }]}
        onOverride={jest.fn()}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/allergy conflict/i)).toBeInTheDocument();
    expect(within(alert).getByText(/Penicillin/)).toBeInTheDocument();

    const link = within(alert).getByRole('link', { name: /view allergy record/i });
    expect(link).toHaveAttribute('href', '/pets/pet-1/records/allergies/allergy-1');
  });

  it('requires a documented rationale before allowing override', () => {
    const onOverride = jest.fn();
    render(
      <AllergyConflictWarning
        conflicts={[{ allergy: allergies[0], matchedTerm: 'Penicillin' }]}
        onOverride={onOverride}
      />,
    );

    const overrideButton = screen.getByRole('button', { name: /override/i });
    expect(overrideButton).toBeDisabled();

    const rationale = screen.getByLabelText(/override rationale/i);
    fireEvent.change(rationale, { target: { value: 'Benefit outweighs risk; monitored.' } });
    expect(overrideButton).toBeEnabled();

    fireEvent.click(overrideButton);
    expect(onOverride).toHaveBeenCalledWith({
      rationale: 'Benefit outweighs risk; monitored.',
      allergyIds: ['allergy-1'],
    });
  });

  it('does not submit override with blank rationale', () => {
    const onOverride = jest.fn();
    render(
      <AllergyConflictWarning
        conflicts={[{ allergy: allergies[1], matchedTerm: 'Chicken' }]}
        onOverride={onOverride}
      />,
    );

    const rationale = screen.getByLabelText(/override rationale/i);
    fireEvent.change(rationale, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /override/i })).toBeDisabled();
    expect(onOverride).not.toHaveBeenCalled();
  });
});
