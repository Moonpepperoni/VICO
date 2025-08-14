import { describe, expect, it } from 'vitest';
import { extractDefinitions } from './constant-propagation';
import { TacProgram } from '../tac/program';
import { BasicBlockControlFlowGraph } from '../cfg/basic-blocks';
import { TacParser } from "../tac/parser.ts";
import type { TacInstruction } from "../tac/parser-types.ts";

describe('extractDefinitions', () => {
    function createBasicBlocksMapFromCode(code: string): Map<number, Array<TacInstruction>> {
        const program = TacProgram.fromParsedInstructions(new TacParser(code).parseTac());
        const cfg = new BasicBlockControlFlowGraph(program);

        // Convert the CFG to the required Map<number, Array<TacInstruction>> format
        const basicBlocks = new Map<number, Array<TacInstruction>>();
        for (const nodeId of cfg.dataNodeIds) {
            const instructions = cfg.getNodeInstructions(nodeId);
            basicBlocks.set(nodeId, instructions);
        }

        return basicBlocks;
    }

    it('should correctly extract a simple constant assignment', () => {
        const basicBlocks = createBasicBlocksMapFromCode('x = 42');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'copy',
            target: 'x',
            use1: { kind: 'constant', value: 42 }
        });
    });

    it('should correctly extract a variable assignment', () => {
        const basicBlocks = createBasicBlocksMapFromCode('y = x');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'copy',
            target: 'y',
            use1: { kind: 'variable', value: 'x' }
        });
    });

    it('should correctly handle binary operations with two variables', () => {
        const basicBlocks = createBasicBlocksMapFromCode('z = x + y');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'binary',
            target: 'z',
            op: '+',
            use1: { kind: 'variable', value: 'x' },
            use2: { kind: 'variable', value: 'y' }
        });
    });

    it('should correctly handle binary operations with constants and variables', () => {
        const basicBlocks = createBasicBlocksMapFromCode('z = 5 + y');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'binary',
            target: 'z',
            op: '+',
            use1: { kind: 'constant', value: 5 },
            use2: { kind: 'variable', value: 'y' }
        });
    });

    it('should correctly handle unary operations with variables', () => {
        const basicBlocks = createBasicBlocksMapFromCode('y = - x');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'unary',
            target: 'y',
            op: '-',
            use1: { kind: 'variable', value: 'x' }
        });
    });

    it('should correctly handle unary operations with constants', () => {
        const basicBlocks = createBasicBlocksMapFromCode('y = - 5');
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(1);
        const def = blockDefs?.[0];

        expect(def).toEqual({
            kind: 'unary',
            target: 'y',
            op: '-',
            use1: { kind: 'constant', value: 5 }
        });
    });

    it('should correctly extract definitions from multiple blocks', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            x = 10
            if x goto L1
            y = 20
            goto L2
            L1: y = 30
            L2: z = x + y
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        // Überprüfe, dass wir mehrere Blöcke haben
        expect(definitions.size).toBeGreaterThan(1);

        // Zähle die Gesamtanzahl der Definitionen
        let totalDefs = 0;
        for (const defs of definitions.values()) {
            totalDefs += defs.length;
        }

        // Wir sollten 4 Definitionen haben: x=10, y=20, y=30, z=x+y
        expect(totalDefs).toBe(4);

        // Prüfe, ob wir beide y-Definitionen haben
        let yDefs = 0;
        for (const defs of definitions.values()) {
            for (const def of defs) {
                if (def.target === 'y') {
                    yDefs++;
                    expect(def.kind).toBe('copy');
                    expect(def.use1.kind).toBe('constant');
                    expect([20, 30]).toContain(def.use1.value);
                }
            }
        }
        expect(yDefs).toBe(2);
    });

    it('should correctly extract definitions from copy instructions', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            x = 5
            y = x
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(2);

        // Check first definition
        expect(blockDefs?.[0]).toEqual({
            kind: 'copy',
            target: 'x',
            use1: { kind: 'constant', value: 5 }
        });

        // Check copy definition
        expect(blockDefs?.[1]).toEqual({
            kind: 'copy',
            target: 'y',
            use1: { kind: 'variable', value: 'x' }
        });
    });

    it('should not extract definitions from non-assignment instructions', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            x = 5
            L2: if x goto L1
            L1: goto L2
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        // Zähle die Gesamtanzahl der Definitionen
        let totalDefs = 0;
        for (const defs of definitions.values()) {
            totalDefs += defs.length;
        }

        // Wir sollten nur eine Definition haben: x=5
        expect(totalDefs).toBe(1);
    });

    it('should handle complex expressions with multiple blocks and assignments', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            i = 0
            sum = 0
            L1: if i >= 5 goto L2
            sum = sum + i
            i = i + 1
            goto L1
            L2: result = sum
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        // Zähle die Gesamtanzahl der Definitionen
        let totalDefs = 0;
        for (const defs of definitions.values()) {
            totalDefs += defs.length;
        }

        // Wir sollten 5 Definitionen haben: i=0, sum=0, sum=sum+i, i=i+1, result=sum
        expect(totalDefs).toBe(5);

        // Prüfe, ob wir die Loop-Inkrementierung haben
        let foundIncrement = false;
        for (const defs of definitions.values()) {
            for (const def of defs) {
                if (def.target === 'i' && def.kind === 'binary' && def.op === '+' &&
                    def.use1?.kind === 'variable' && def.use1.value === 'i' &&
                    def.use2?.kind === 'constant' && def.use2.value === 1) {
                    foundIncrement = true;
                }
            }
        }
        expect(foundIncrement).toBe(true);
    });

    it('should correctly extract multiple definitions in a single block', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            a = 1
            b = 2
            c = 3
            d = a + b
            e = b * c
            f = d - e
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(6);

        // Check last definition
        const lastDef = blockDefs?.[5];
        expect(lastDef).toBeDefined();
        expect(lastDef?.kind).toEqual('binary');
        expect(lastDef?.target).toBe('f');
        if (lastDef?.kind !== 'binary') {
            throw new Error('should never happen');
        }
        expect(lastDef?.op).toBe('-');
        expect(lastDef?.use1).toEqual({ kind: 'variable', value: 'd' });
        expect(lastDef?.use2).toEqual({ kind: 'variable', value: 'e' });
    });

    it('should correctly extract redefinitions in a single block', () => {
        const basicBlocks = createBasicBlocksMapFromCode(`
            y = 0
            x = y + 10
            x = x + x
        `);
        const { definitions } = extractDefinitions(basicBlocks);

        expect(definitions.size).toBe(1);
        const blockId = [...definitions.keys()][0];
        const blockDefs = definitions.get(blockId);

        expect(blockDefs?.length).toBe(3);

        // First definition: y = 0
        expect(blockDefs?.[0]).toEqual({
            kind: 'copy',
            target: 'y',
            use1: { kind: 'constant', value: 0 }
        });

        // Second definition: x = y + 10
        expect(blockDefs?.[1]).toEqual({
            kind: 'binary',
            target: 'x',
            op: '+',
            use1: { kind: 'variable', value: 'y' },
            use2: { kind: 'constant', value: 10 }
        });

        // Third definition: x = x + x
        expect(blockDefs?.[2]).toEqual({
            kind: 'binary',
            target: 'x',
            op: '+',
            use1: { kind: 'variable', value: 'x' },
            use2: { kind: 'variable', value: 'x' }
        });
    });
});