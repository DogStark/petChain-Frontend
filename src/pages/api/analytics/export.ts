import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { format = 'csv' } = req.query;

  const data = {
    userMetrics: { totalUsers: 1247, activeUsers: 892, newSignups: 156, retentionRate: 71.5 },
    vaccinationCompliance: { compliant: 856, nonCompliant: 124, rate: 87.3 },
    appointmentStats: { total: 2341, completed: 1876, cancelled: 234, upcoming: 231 },
  };

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=analytics_${Date.now()}.json`);
    return res.status(200).json(data);
  }

  if (format === 'csv') {
    const csv = [
      'Metric,Value',
      `Total Users,${data.userMetrics.totalUsers}`,
      `Active Users,${data.userMetrics.activeUsers}`,
      `New Signups,${data.userMetrics.newSignups}`,
      `Retention Rate,${data.userMetrics.retentionRate}%`,
      '',
      'Vaccination Compliance',
      `Compliant,${data.vaccinationCompliance.compliant}`,
      `Non-Compliant,${data.vaccinationCompliance.nonCompliant}`,
      `Compliance Rate,${data.vaccinationCompliance.rate}%`,
      '',
      'Appointment Statistics',
      `Total,${data.appointmentStats.total}`,
      `Completed,${data.appointmentStats.completed}`,
      `Cancelled,${data.appointmentStats.cancelled}`,
      `Upcoming,${data.appointmentStats.upcoming}`,
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=analytics_${Date.now()}.csv`);
    return res.status(200).send(csv);
  }

  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=analytics_${Date.now()}.pdf`);
    return res.status(501).json({ error: 'PDF export not yet implemented' });
  }

  res.status(400).json({ error: 'Invalid format' });
}
