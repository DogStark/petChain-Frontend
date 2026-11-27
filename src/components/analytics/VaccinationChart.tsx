import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface VaccinationCompliancePoint {
  month: string;
  compliant: number;
  nonCompliant: number;
}

export interface VaccineTypeBreakdown {
  vaccineType: string;
  compliant: number;
  nonCompliant: number;
}

export interface NonCompliantPet {
  id: string;
  name: string;
  species: string;
  ownerName: string;
  vaccineType: string;
  dueDate: string;
  daysOverdue: number;
}

export interface VaccinationChartProps {
  data: VaccinationCompliancePoint[];
  breakdown?: VaccineTypeBreakdown[];
  nonCompliantPets?: NonCompliantPet[];
}

const tooltipStyle = {
  backgroundColor: '#fff',
  borderRadius: '8px',
  border: 'none',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
};

const VaccinationChart: React.FC<VaccinationChartProps> = ({
  data,
  breakdown = [],
  nonCompliantPets = [],
}) => {
  const [selectedVaccineType, setSelectedVaccineType] = useState<string | null>(null);

  const drillDownPets = useMemo(
    () =>
      selectedVaccineType
        ? nonCompliantPets.filter((pet) => pet.vaccineType === selectedVaccineType)
        : nonCompliantPets,
    [nonCompliantPets, selectedVaccineType],
  );

  return (
    <div className="bg-white/60 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-transparent hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
      <h3 className="text-lg font-bold mb-4 text-blue-700">Vaccination Compliance Rates</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#9ca3af" />
            <YAxis domain={[0, 100]} unit="%" stroke="#9ca3af" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line
              type="monotone"
              dataKey="compliant"
              name="Compliant %"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="nonCompliant"
              name="Non-Compliant %"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {breakdown.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-bold mb-2 text-blue-700">Breakdown by Vaccine Type</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={breakdown}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="vaccineType" stroke="#9ca3af" />
                <YAxis domain={[0, 100]} unit="%" stroke="#9ca3af" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="compliant" name="Compliant %" fill="#10b981" />
                <Bar dataKey="nonCompliant" name="Non-Compliant %" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h4 className="text-sm font-bold text-blue-700">
            Non-Compliant Pets ({drillDownPets.length})
          </h4>
          {selectedVaccineType && (
            <button
              type="button"
              onClick={() => setSelectedVaccineType(null)}
              className="rounded-lg border border-blue-700 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
            >
              Clear filter: {selectedVaccineType}
            </button>
          )}
        </div>
        {breakdown.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {breakdown.map((entry) => (
              <button
                key={entry.vaccineType}
                type="button"
                aria-pressed={selectedVaccineType === entry.vaccineType}
                onClick={() =>
                  setSelectedVaccineType((current) =>
                    current === entry.vaccineType ? null : entry.vaccineType,
                  )
                }
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  selectedVaccineType === entry.vaccineType
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                {entry.vaccineType}
              </button>
            ))}
          </div>
        )}
        {drillDownPets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">Non-compliant pets</caption>
              <thead>
                <tr>
                  {['Pet', 'Species', 'Owner', 'Vaccine', 'Due date', 'Days overdue'].map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="border-b border-gray-500 px-3 py-2 font-bold text-gray-950"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drillDownPets.map((pet) => (
                  <tr key={pet.id} className="odd:bg-gray-50">
                    <th scope="row" className="border-b border-gray-400 px-3 py-2 font-semibold text-gray-950">
                      {pet.name}
                    </th>
                    <td className="border-b border-gray-400 px-3 py-2 text-gray-900">{pet.species}</td>
                    <td className="border-b border-gray-400 px-3 py-2 text-gray-900">{pet.ownerName}</td>
                    <td className="border-b border-gray-400 px-3 py-2 text-gray-900">{pet.vaccineType}</td>
                    <td className="border-b border-gray-400 px-3 py-2 text-gray-900">{pet.dueDate}</td>
                    <td className="border-b border-gray-400 px-3 py-2 text-gray-900">{pet.daysOverdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-800">No non-compliant pets for this selection.</p>
        )}
      </div>
    </div>
  );
};

export default VaccinationChart;
