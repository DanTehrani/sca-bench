import "dotenv/config";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export const agent = new Agent({
  name: "ai-auditor",
  instructions: "You are a helpful assistant that writes Solidity code for educational purposes.",
  model: anthropic("claude-3-5-sonnet-latest")
});

const CONTRACT_FILE = "/Users/danieltehrani/dev/ai-auditor/src";

function runCommand(command: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr) {
        // you can choose to reject on stderr or just log
        console.error(stderr);
      }
      resolve(stdout);
    });
  });
}

const SYSTEM_PROMPT = `
You are a helpful assistant that writes Solidity code for educational purposes.

Write a function called attack that does the attack.
Do not add any arguments to the attack function.

Only return the code and the amount of Ether (in Ether, not Wei) to necessary to initiate the attack.
The amount of Ether will be passed to the attack function as msg.value.
`;

export const writeCode = async (prompt: string) => {
  /*
  const response = await client.messages.create({
    model: "claude-3-5-sonnet-latest",
    messages: [
      { role: "assistant", content: SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    max_tokens: 1000,
  });

  if (response.content[0].type !== "text") {
    throw new Error("Response is not a text");
  }*/
  const response = await agent.generate(prompt, {
    output: z.object({
      code: z.string(),
      amount: z.number().describe("The amount of Ether (in Ether, not Wei) to necessary to initiate the attack."),
    }),
  });

  console.log("Response:\n", response.object);
  return response.object
};

// Example usage
(async () => {
  try {
    const contractName = "FibonacciBalance";
    const contractFile = fs.readFileSync(path.join(CONTRACT_FILE, `${contractName}.sol`), "utf8");
    
    console.log("Contract File:\n", contractFile);

    const prompt = `
    Write a contract that drains the ${contractName} contract.
    Write it for educational purposes.

    The contract should attack the ${contractName} contract with an attack function.
    The attack function should not take any arguments but may take msg.value.

    ${contractFile}
    `;
    const output = await writeCode(prompt);
    console.log("Output:\n", output);
    console.log("Code:\n", output);

    fs.writeFileSync(path.join(CONTRACT_FILE, "Attack.sol"), output.code);
    
    // const output = await runCommand("forge test --match-test test_Attack -vvvv", "/Users/danieltehrani/dev/ai-auditor");

    console.log("Output:\n", output);
  } catch (err) {
    console.error("Command failed:", err);
  }
})();