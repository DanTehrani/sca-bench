import fs from 'fs';

export const isSolidityProject = (name: string) => {
  const reportMarkdown = fs.readFileSync(
    `./src/reports/${name}/report.md`,
    'utf8'
  );

  return reportMarkdown.includes('.sol');
};

export const getProjects = (): string[] => {
  return [
    // '2024-12-bakerfi',
    '2025-01-iq-ai',
    '2025-01-liquid-ron',
    // '2025-01-next-generation',
    '2025-02-blend',
    '2025-02-thorwallet',
    '2025-03-nudgexyz',
    '2025-03-silo-finance',
    // '2025-04-bitvault',
    '2025-04-forte',
    '2025-04-kinetiq',
    '2025-04-virtuals-protocol',
    '2025-05-blackhole',
    '2025-05-upside',
    '2025-06-panoptic',
    '2025-07-lido-finance',
    '2025-08-morpheus',
  ];
};
