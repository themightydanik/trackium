(function (root) {
  'use strict';
  // Fixed snapshot, not a simulator and never a fallback for a failed Gateway request.
  const devices = [
    {
      id: '6b6c68dd-c05d-470a-a28f-616aa7bc8481',
      label: 'Cargo sensor 01',
      mode: 'synthetic',
      enabled: true,
      short: 'TRK–001',
      battery: 92,
      temperature: 4.2,
      humidity: 48,
      status: 'moving',
      latitude: 51.11,
      longitude: 17.04,
      city: 'Wrocław, PL',
      last: '12:00',
      shipment: 'TC–2048'
    },
    {
      id: '6b6c68dd-c05d-470a-a28f-616aa7bc8482',
      label: 'Cargo sensor 02',
      mode: 'synthetic',
      enabled: true,
      short: 'TRK–002',
      battery: 76,
      temperature: 6.8,
      humidity: 52,
      status: 'alarm',
      latitude: 50.08,
      longitude: 14.44,
      city: 'Prague, CZ',
      last: '11:58',
      shipment: 'TC–2049'
    },
    {
      id: '6b6c68dd-c05d-470a-a28f-616aa7bc8483',
      label: 'Cargo sensor 03',
      mode: 'synthetic',
      enabled: true,
      short: 'TRK–003',
      battery: 64,
      temperature: 18.5,
      humidity: 43,
      status: 'stationary',
      latitude: 51.92,
      longitude: 4.48,
      city: 'Rotterdam, NL',
      last: '11:55',
      shipment: 'TC–2050'
    },
    {
      id: '6b6c68dd-c05d-470a-a28f-616aa7bc8484',
      label: 'Cargo sensor 04',
      mode: 'synthetic',
      enabled: false,
      short: 'TRK–004',
      battery: null,
      temperature: null,
      humidity: null,
      status: 'unknown',
      latitude: null,
      longitude: null,
      city: 'No GPS fix',
      last: '—',
      shipment: null
    }
  ];
  const shipments = [
    {
      id: 'TC–2048',
      name: 'Fresh produce',
      reference: 'REF 084–PL',
      origin: 'Rotterdam',
      destination: 'Kyiv',
      from: 'NL',
      to: 'UA',
      status: 'In transit',
      progress: 64,
      cargo: 'Cold chain · 18 pallets',
      device: devices[0].id,
      route: [
        [4.48, 51.92],
        [8.68, 50.11],
        [17.04, 51.11],
        [24.03, 49.84],
        [30.52, 50.45]
      ],
      stops: [
        'Rotterdam · loaded',
        'Frankfurt · departed',
        'Wrocław · in transit',
        'Lviv · planned',
        'Kyiv · destination'
      ],
      eta: '08 Nov · 16:30',
      distance: '1,840 km'
    },
    {
      id: 'TC–2049',
      name: 'Pharmaceuticals',
      reference: 'REF 112–CZ',
      origin: 'Prague',
      destination: 'Warsaw',
      from: 'CZ',
      to: 'PL',
      status: 'Attention',
      progress: 28,
      cargo: 'Temperature sensitive · 6 pallets',
      device: devices[1].id,
      route: [
        [14.44, 50.08],
        [17.04, 51.11],
        [21.01, 52.23]
      ],
      stops: ['Prague · temperature alert', 'Wrocław · planned', 'Warsaw · destination'],
      eta: '08 Nov · 09:00',
      distance: '680 km'
    },
    {
      id: 'TC–2050',
      name: 'Industrial components',
      reference: 'REF 076–NL',
      origin: 'Rotterdam',
      destination: 'Hamburg',
      from: 'NL',
      to: 'DE',
      status: 'At origin',
      progress: 8,
      cargo: 'General cargo · 12 pallets',
      device: devices[2].id,
      route: [
        [4.48, 51.92],
        [7.47, 51.51],
        [9.99, 53.55]
      ],
      stops: ['Rotterdam · at origin', 'Dortmund · planned', 'Hamburg · destination'],
      eta: '08 Nov · 12:00',
      distance: '510 km'
    }
  ];
  const readings = [4.0, 4.1, 3.9, 4.2, 4.3, 4.0, 4.1, 4.2, 4.0, 4.3, 4.1, 4.2];
  const events = devices
    .slice(0, 3)
    .flatMap((device, i) =>
      readings.map((temperature, j) => ({
        id: 'demo-event-' + i + '-' + j,
        device_id: device.id,
        label: device.label,
        short: device.short,
        occurred_at: '2026-11-07T' + String(j + 1).padStart(2, '0') + ':00:00.000Z',
        payload: {
          schema_version: 1,
          source: 'fixture-v1',
          trust: 'synthetic',
          source_event_id: 'demo-' + i + '-' + j,
          device_id: device.id,
          occurred_at: '2026-11-07T' + String(j + 1).padStart(2, '0') + ':00:00.000Z',
          gps: { latitude: device.latitude, longitude: device.longitude },
          temperature_c: Number((temperature + (i === 1 ? 2.6 : i === 2 ? 14.3 : 0)).toFixed(1)),
          humidity_pct: device.humidity + (j === 11 ? 0 : (j % 3) - 1),
          battery_pct: device.battery,
          status: i === 1 && j === 11 ? 'alarm' : device.status,
          extra: {}
        }
      }))
    )
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || a.id.localeCompare(b.id));
  root.TrackiumDemo = {
    snapshot: '2026-11-07T12:00:00.000Z',
    create: function () {
      return JSON.parse(JSON.stringify({ devices, shipments, events }));
    }
  };
})(window);
