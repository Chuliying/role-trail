import { hash } from './workbench.mjs';
export function demoActions() {
  const stamp = new Date().toISOString();
  return [
    {
      type: 'profile',
      profile: {
        name: 'Alex Morgan (synthetic)',
        targetRoles: ['Product Engineer'],
        location: 'Example City',
        remotePolicy: 'Worldwide remote',
        timezone: 'UTC',
        languages: ['English'],
        ownershipPolicy: 'None',
        platforms: ['manual'],
        portfolio: 'https://example.com',
        feeds: [],
      },
    },
    {
      type: 'capability',
      id: 'demo-ui',
      claim:
        'Built an accessible component library and tested keyboard navigation in a synthetic portfolio project.',
      tags: ['React', 'accessibility', 'TypeScript'],
      evidence: ['Synthetic repository: demo-sha / src/components.tsx. Not a real candidate.'],
      status: 'confirmed',
    },
    {
      type: 'capability',
      id: 'demo-api',
      claim:
        'Implemented a typed API client with retries and visible error states in a synthetic project.',
      tags: ['TypeScript', 'API'],
      evidence: ['Synthetic repository: demo-sha / src/client.ts.'],
      status: 'confirmed',
    },
    {
      type: 'research',
      run: {
        id: 'synthetic-demo',
        kind: 'demo',
        coverage: [
          {
            source: 'manual',
            status: 'partial',
            query: 'Synthetic examples',
            screened: 3,
            fullJd: 3,
            note: 'All companies, roles and evidence in this demo are invented.',
          },
        ],
      },
      jobs: [
        {
          company: 'Northstar Studio (demo)',
          title: 'Product Engineer',
          url: 'https://example.com/jobs/product',
          source: 'manual',
          location: 'Worldwide',
          remoteMode: 'remote',
          descriptionKind: 'full',
          description:
            '## About the role\nBuild a collaborative research product for distributed teams.\n\n## Responsibilities\n- Build accessible React and TypeScript interfaces.\n- Integrate APIs with reliable loading and error states.\n- Partner with design and research.\n\n## Requirements\n- Experience shipping production interfaces.\n- English collaboration.\n- Availability across UTC to UTC+8.\n\nSynthetic demo only. No actual opening.',
          searchedAt: stamp,
        },
        {
          company: 'Fieldwork Labs (demo)',
          title: 'Design Engineer',
          url: 'https://example.com/jobs/design',
          source: 'manual',
          remoteMode: 'hybrid',
          location: 'Example City',
          descriptionKind: 'full',
          description:
            '## Role\nDesign and implement interactive product prototypes.\n- React and animation experience.\n- Onsite workshops once a month.\n\nSynthetic demo only.',
          searchedAt: stamp,
        },
        {
          company: 'Archive Works (demo)',
          title: 'Frontend Engineer',
          url: 'https://example.com/jobs/closed',
          source: 'manual',
          descriptionKind: 'full',
          description: 'Synthetic closed opening.',
          availability: {
            status: 'closed',
            source: 'https://example.com/jobs/closed',
            evidence: 'Synthetic closure evidence; not an actual job.',
            checkedAt: stamp,
          },
          searchedAt: stamp,
        },
      ],
    },
    {
      type: 'assessment',
      jobId: hash('https://example.com/jobs/product').slice(0, 24),
      score: 8,
      reason:
        'Synthetic assessment: confirmed React accessibility and API interface examples match the role. Production scale and collaboration across timezones still need evidence. This is not a hiring probability.',
      evidence: [
        'demo-ui: accessible component library',
        'demo-api: typed API client and failure states',
      ],
      gaps: [
        'Prepare an example of a production reliability tradeoff.',
        'Confirm working-hour overlap and long-term location eligibility.',
      ],
      checkedAt: stamp,
    },
  ];
}
