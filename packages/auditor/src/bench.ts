import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import fs from 'fs';
import { z } from 'zod';

const judgeAgent = new Agent({
  name: 'ai-auditor',
  instructions:
    'You are a helpful assistant that judges if the vulnerability report is valid or not.',
  model: openai('gpt-4o'),
});

type Finding = {
  id?: number;
  title: string;
  description: string;
  proofOfConcept: string;
};

const judgeFinding = async ({
  correctFindings,
  agentFinding,
}: {
  correctFindings: Finding[];
  agentFinding: Finding;
}) => {
  const response = await judgeAgent.generate(
    `
    Given the correct findings and the predicted finding, check if the predicted finding match any of the correct findings.
    If there is a match, return the id (in the correct findings list) of the matched finding.
    If there is no match, return null.

    The predicted finding is:
    ${JSON.stringify(agentFinding)}

    The correct findings are:
    ${JSON.stringify(correctFindings)}
    `,
    {
      output: z.object({
        matchedFinding: z.object({
          id: z.number().nullable(),
        }),
      }),
    }
  );

  return response.object.matchedFinding;
};

const benchProject = async ({
  findingsDir,
  projectName,
  benchmarkDir,
}: {
  findingsDir: string;
  projectName: string;
  benchmarkDir: string;
}) => {
  // Load correct findings
  const correctFindings: Finding[] = JSON.parse(
    fs.readFileSync(`./src/tasks/${projectName}/findings.json`, 'utf8')
  ).findings;

  // Load the predicted findings
  const agentFindings: Finding[] = JSON.parse(
    fs.readFileSync(`${findingsDir}/${projectName}/findings.json`, 'utf8')
  );

  const matchedFindings: number[] = [];
  for (const agentFinding of agentFindings) {
    const matchedFinding = await judgeFinding({
      correctFindings,
      agentFinding,
    });

    if (matchedFinding.id) {
      matchedFindings.push(matchedFinding.id);
    }
  }

  const missedFindings = correctFindings.filter(
    correctFinding =>
      !matchedFindings.some(
        matchedFinding => matchedFinding === correctFinding.id
      )
  );

  const result = {
    matchedFindings,
    missedFindings,
  };

  const benchmarkFileName = `${benchmarkDir}/${projectName}.json`;

  // Save the result
  fs.writeFileSync(benchmarkFileName, JSON.stringify(result, null, 2));

  return result;
};

const bench = async (findingsDir: string) => {
  const projectNames = fs.readdirSync(findingsDir);

  fs.mkdirSync('./src/benchmarks', { recursive: true });

  const benchmarkDir = './src/benchmarks/' + new Date().toISOString();
  fs.mkdirSync(benchmarkDir, { recursive: true });

  const results: {
    projectName: string;
    matchedFindings: number;
    missedFindings: number;
  }[] = [];
  for (const projectName of projectNames) {
    const result = await benchProject({
      projectName,
      benchmarkDir,
      findingsDir,
    });

    results.push({
      projectName,
      matchedFindings: result.matchedFindings.length,
      missedFindings: result.missedFindings.length,
    });
  }

  fs.writeFileSync(
    `${benchmarkDir}/results.json`,
    JSON.stringify(results, null, 2)
  );
};

export default bench;

bench('./src/findings/2025-09-17T19:10:59.360Z');
