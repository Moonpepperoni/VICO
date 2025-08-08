import { describe, expect, it } from 'vitest';
import { extractGenAndKillFromBasicBlocks } from './reaching-definitions';
import { TacProgram } from '../tac/program';
import { BasicBlockControlFlowGraph } from '../cfg/basic-blocks';
import {TacParser} from "../tac/parser.ts";
import type {TacInstruction} from "../tac/parser-types.ts";

describe('extractGenAndKillFromBasicBlocks', () => {
    function createBasicBlocksFromCode(code: string): Map<number, Array<TacInstruction>> {
        const program = TacProgram.fromParsedInstructions(new TacParser(code).parseTac());
        const cfg = new BasicBlockControlFlowGraph(program);

        // Convert the CFG to a Map of basic blocks with their instructions
        const basicBlocks = new Map();
        for (const nodeId of cfg.dataNodeIds) {
            basicBlocks.set(nodeId, cfg.getNodeInstructions(nodeId));
        }

        return basicBlocks;
    }


    it('should extract gen set with a single definition', () => {
        const basicBlocks = createBasicBlocksFromCode('x = 5');
        const blockId = [...basicBlocks.keys()][0];

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // The gen set should contain a single definition
        expect(genSets.get(blockId)?.size).toBe(1);
        expect([...genSets.get(blockId)!][0].startsWith('d')).toBe(true);

        // The kill set should be empty
        expect(killSets.get(blockId)?.size).toBe(0);
    });

    it('should handle multiple assignments to the same variable within a block', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 5
      x = 10
    `);
        const blockId = [...basicBlocks.keys()][0];

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // The gen set should contain the last definition
        expect(genSets.get(blockId)?.size).toBe(1);

        // The kill set should be empty since all kills are within the same block
        expect(killSets.get(blockId)?.size).toBe(0);
    });

    it('should handle definitions across multiple blocks', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 5
      if x goto L1
      x = 10
      L1: y = x
    `);

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // We should have multiple blocks, each with gen sets
        expect(genSets.size).toBeGreaterThanOrEqual(2);

        // Count the total number of definitions
        let totalDefs = 0;
        for (const genSet of genSets.values()) {
            totalDefs += genSet.size;
        }

        // Expecting at least 3 definitions: x=5, x=10, y=x
        expect(totalDefs).toBeGreaterThanOrEqual(3);

        // Look for a block with a kill set (should be the one that redefines x)
        let foundKill = false;
        for (const killSet of killSets.values()) {
            if (killSet.size > 0) {
                foundKill = true;
                break;
            }
        }

        expect(foundKill).toBe(true);
    });

    it('should handle independent variables correctly', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 1
      y = 2
      z = 3
    `);
        const blockId = [...basicBlocks.keys()][0];

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // The gen set should contain three definitions
        expect(genSets.get(blockId)?.size).toBe(3);

        // The kill set should be empty
        expect(killSets.get(blockId)?.size).toBe(0);
    });

    it('should handle binary and unary operations', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 5
      y = x + 10
      z = - y
    `);
        const blockId = [...basicBlocks.keys()][0];

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // The gen set should contain three definitions
        expect(genSets.get(blockId)?.size).toBe(3);

        // The kill set should be empty
        expect(killSets.get(blockId)?.size).toBe(0);
    });

    it('should not generate definitions for non-assignment instructions', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 5
      if x goto L1
      goto L2
      L1: y = 10
      L2: z = 15
    `);

        const { genSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // Count the total number of definitions
        let totalDefs = 0;
        for (const genSet of genSets.values()) {
            totalDefs += genSet.size;
        }

        // We should have exactly 3 definitions (x=5, y=10, z=15)
        // Jump and conditional instructions don't generate definitions
        expect(totalDefs).toBe(3);
    });

    it('should handle complex control flow with multiple branches', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      x = 1
      if x goto L1
      x = 2
      goto L2
      L1: x = 3
      L2: y = x
    `);

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // We should have at least 3 blocks
        expect(genSets.size).toBeGreaterThanOrEqual(3);

        // Count the total number of definitions
        let totalDefs = 0;
        for (const genSet of genSets.values()) {
            totalDefs += genSet.size;
        }

        // We should have 4 definitions (x=1, x=2, x=3, y=x)
        expect(totalDefs).toBe(4);

        // Look for blocks with kill sets
        let blocksWithKills = 0;
        for (const killSet of killSets.values()) {
            if (killSet.size > 0) {
                blocksWithKills++;
            }
        }

        // Both x=2 and x=3 should kill x=1
        expect(blocksWithKills).toBeGreaterThanOrEqual(2);
    });

    it('should handle loops correctly', () => {
        const basicBlocks = createBasicBlocksFromCode(`
      i = 0
      L1: if i >= 5 goto L2
      i = i + 1
      goto L1
      L2: x = i
    `);

        const { genSets, killSets } = extractGenAndKillFromBasicBlocks(basicBlocks);

        // Count the total number of definitions
        let totalDefs = 0;
        for (const genSet of genSets.values()) {
            totalDefs += genSet.size;
        }

        // We should have 3 definitions (i=0, i=i+1, x=i)
        expect(totalDefs).toBe(3);

        // Find the block with i=i+1 and check that it kills i=0
        let foundKillInLoop = false;
        for (const [blockId, genSet] of genSets.entries()) {
            // Find the block with i=i+1
            const iIncBlock = [...genSet].some(def => def.startsWith('d'));
            if (iIncBlock) {
                const killSet = killSets.get(blockId);
                if (killSet && killSet.size > 0) {
                    foundKillInLoop = true;
                    break;
                }
            }
        }

        expect(foundKillInLoop).toBe(true);
    });
});