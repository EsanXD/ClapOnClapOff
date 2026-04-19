import type { ClapEvent } from '../hooks/useClapDetection';

export const exportEventsToCSV = (events: ClapEvent[]) => {
  const headers = [
    'ID',
    'Timestamp (s)',
    'Event Type',
    'Origin (System/Manual)',
    'Engine ID',
    'Interval (ms)',
    'Ambient Level (RMS)',
    'Sensitivity Setting',
    'Brightness Ratio',
    'Ground Truth Analysis'
  ];

  const rows = events.map(event => [
    event.id,
    event.timestamp.toFixed(3),
    event.type,
    event.origin.toUpperCase(),
    event.engineId.toUpperCase(),
    event.interval || '',
    event.ambientLevel.toFixed(5),
    event.sensitivity.toFixed(2),
    event.brightness?.toFixed(3) || 'N/A',
    event.origin === 'manual' ? 'MISSED CLAP' : (event.isFalsePositive ? 'INVALID/FALSE-POSITIVE' : 'VALID/CORRECT')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `diagnostic_session_${new Date().toISOString()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
