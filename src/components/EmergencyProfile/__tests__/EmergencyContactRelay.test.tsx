import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';

import { EmergencyContactRelay } from '../EmergencyContactRelay';
import { EmergencyContact } from '@/types/pet';

const publicContact: EmergencyContact = {
  id: 'c1',
  name: 'Jane Doe',
  relationship: 'Vet',
  phone: '+1-555-0100',
  email: 'jane@example.com',
  priority: 1,
  isPublic: true,
};

const privateContact: EmergencyContact = {
  id: 'c2',
  name: 'Bob Smith',
  relationship: 'Neighbor',
  phone: '+1-555-0200',
  priority: 2,
  isPublic: false,
};

describe('EmergencyContactRelay', () => {
  it('renders the disclosure heading and relay availability', () => {
    render(
      <EmergencyContactRelay contacts={[publicContact, privateContact]} revealDirect={false} />,
    );
    expect(
      screen.getByRole('heading', { name: /how responders can reach you/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/secure relay/i);
  });

  it('hides direct phone/email when not opted in', () => {
    render(
      <EmergencyContactRelay contacts={[publicContact, privateContact]} revealDirect={false} />,
    );
    expect(screen.queryByText('+1-555-0100')).not.toBeInTheDocument();
    expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument();
    // both contacts are reachable via relay
    expect(screen.getAllByText(/relay only/i)).toHaveLength(2);
  });

  it('reveals direct contact details when opted in', () => {
    render(
      <EmergencyContactRelay contacts={[publicContact, privateContact]} revealDirect={true} />,
    );
    expect(screen.getByText('+1-555-0100')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('Direct')).toBeInTheDocument();
    // private contact is not disclosed directly
    expect(screen.getAllByText(/relay only/i)).toHaveLength(1);
  });

  it('reports opt-in changes to the parent', () => {
    const onRevealChange = jest.fn();
    render(
      <EmergencyContactRelay
        contacts={[publicContact]}
        revealDirect={false}
        onRevealChange={onRevealChange}
      />,
    );
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(onRevealChange).toHaveBeenCalledWith(true);
  });

  it('prompts for a contact when none are configured', () => {
    render(<EmergencyContactRelay contacts={[]} revealDirect={false} />);
    expect(screen.getByText(/add at least one emergency contact/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(
      <EmergencyContactRelay contacts={[publicContact, privateContact]} revealDirect={false} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
