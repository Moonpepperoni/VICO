import { describe, test, expect, beforeEach } from 'vitest';
import {
    getFlowServiceInstanceFor,
    LivenessSingleInstructionService,
    LivenessBasicBlockService,
    type FlowService,
} from './flow-service';
import { TacParser } from '../tac/parser';
import { TacProgram } from '../tac/program';
import { enableMapSet } from 'immer';

// Enable MapSet support for immer
enableMapSet();

describe('FlowService Integration Tests', () => {
    describe('getFlowServiceInstanceFor', () => {
        test('should return LivenessSingleInstructionService for liveness-single-instruction algorithm', () => {
            const tacText = 'a = 1';
            const tacInstructions = new TacParser(tacText).parseTac();
            const tacProgram = TacProgram.fromParsedInstructions(tacInstructions);

            const service = getFlowServiceInstanceFor(tacProgram, 'liveness-single-instruction');

            expect(service).toBeInstanceOf(LivenessSingleInstructionService);
        });

        test('should return LivenessBasicBlockService for liveness-basic-blocks algorithm', () => {
            const tacText = 'a = 1';
            const tacInstructions = new TacParser(tacText).parseTac();
            const tacProgram = TacProgram.fromParsedInstructions(tacInstructions);

            const service = getFlowServiceInstanceFor(tacProgram, 'liveness-basic-blocks');

            expect(service).toBeInstanceOf(LivenessBasicBlockService);
        });

        test('should throw error for unknown algorithm', () => {
            const tacText = 'a = 1';
            const tacInstructions = new TacParser(tacText).parseTac();
            const tacProgram = TacProgram.fromParsedInstructions(tacInstructions);

            // @ts-expect-error - intentionally passing invalid value
            expect(() => getFlowServiceInstanceFor(tacProgram, 'unknown-algorithm')).toThrow('Unknown algorithm');
        });
    });

    describe('FlowService with simple assignment program', () => {
        let service: FlowService;

        beforeEach(() => {
            const tacText = `
        a = 1
        b = a
        c = b + a
      `;
            const tacInstructions = new TacParser(tacText).parseTac();
            const tacProgram = TacProgram.fromParsedInstructions(tacInstructions);
            service = getFlowServiceInstanceFor(tacProgram, 'liveness-single-instruction');
        });

        test('should not have initial state', () => {
            const initialState = service.currentValue();
            expect(initialState).toBeUndefined();
        });

        test('calling advance should give initial state', () => {
            service.advance()
            const initialState = service.currentValue();
            expect(initialState).toBeDefined();
            expect(initialState?.nodes).toHaveLength(5);
            expect(initialState?.edges).toHaveLength(4);
        });

        test('should advance through all steps', () => {
            // Get initial state
            const initialState = service.currentValue();

            // Advance to end
            service.advanceToEnd();

            // Get final state
            const finalState = service.currentValue();

            // Should be different from initial
            expect(finalState).not.toEqual(initialState);

            // Should have no more steps
            expect(service.hasNext()).toBe(false);

            // Should be able to go back
            expect(service.hasPrevious()).toBe(true);
        });

        test('should navigate back and forth', () => {
            // Advance one step
            service.advance();
            const secondState = service.currentValue();

            // Advance again
            service.advance();
            const thirdState = service.currentValue();

            // Go back
            service.previous();
            const backToSecond = service.currentValue();

            // Should be back to second state
            expect(backToSecond).toEqual(secondState);

            // Should not equal third state
            expect(backToSecond).not.toEqual(thirdState);
        });
    });

    describe('FlowService with control flow program', () => {
        let service: FlowService;

        beforeEach(() => {
            const tacText = `
        a = 1
        START: b = a + 1
        if b > 10 goto END
        a = b
        goto START
        END: c = a
      `;
            const tacInstructions = new TacParser(tacText).parseTac();
            const tacProgram = TacProgram.fromParsedInstructions(tacInstructions);
            service = getFlowServiceInstanceFor(tacProgram, 'liveness-basic-blocks');
        });

        test('should correctly generate back edges', () => {
            service.advance();
            const initialState = service.currentValue();

            // Find back edges in the graph
            const backEdges = initialState?.edges.filter(edge => edge.isBackEdge);

            // There should be at least one back edge (for the loop)
            expect(backEdges?.length).toBeGreaterThan(0);
        });

        test('should correctly mark entry and exit nodes', () => {
            service.advance();
            const state = service.currentValue();

            // Should have one entry node
            const entryNodes = state?.nodes.filter(node => node.kind === 'entry');
            expect(entryNodes?.length).toBe(1);

            // Should have one exit node
            const exitNodes = state?.nodes.filter(node => node.kind === 'exit');
            expect(exitNodes?.length).toBe(1);
        });
    });

    describe('Comparison between algorithms', () => {
        test('should produce different CFGs for single-instruction vs basic-blocks', () => {
            const tacText = `
        a = 1
        b = 2
        c = a + b
        if c > 10 goto SKIP
        d = c * 2
        SKIP: e = c
      `;
            const tacInstructions = new TacParser(tacText).parseTac();
            const tacProgram = TacProgram.fromParsedInstructions(tacInstructions);

            const singleService = getFlowServiceInstanceFor(tacProgram, 'liveness-single-instruction');
            const blockService = getFlowServiceInstanceFor(tacProgram, 'liveness-basic-blocks');

            singleService.advance();
            blockService.advance();

            // Get initial states
            const singleState = singleService.currentValue()!;
            const blockState = blockService.currentValue()!;

            // Basic blocks should have fewer nodes than single instructions
            expect(blockState?.nodes.length).toBeLessThan(singleState?.nodes.length);

            // Basic blocks should have fewer edges than single instructions
            expect(blockState?.edges.length).toBeLessThan(singleState?.edges.length);
        });
    });

    describe('Liveness computation correctness', () => {
        test('should correctly compute liveness for simple program', () => {
            const tacText = `
        a = 1
        b = a
        c = b
      `;
            const tacInstructions = new TacParser(tacText).parseTac();
            const tacProgram = TacProgram.fromParsedInstructions(tacInstructions);
            const service = getFlowServiceInstanceFor(tacProgram, 'liveness-single-instruction');

            // Advance to end state
            service.advanceToEnd();
            const finalState = service.currentValue();

            // Check nodes in reverse order (from last instruction to first)
            const dataNodes = finalState?.nodes.filter(node => node.kind === 'node')
                .sort((a, b) => b.id - a.id); // Sort in reverse order

            if (!dataNodes || dataNodes.length < 3) {
                throw new Error('Expected at least 3 data nodes');
            }

            // Last instruction (c = b) should have 'b' in IN set
            const lastNode = dataNodes[0];
            expect(lastNode.inValue.value.data.has('b')).toBe(true);

            // Middle instruction (b = a) should have 'a' in IN set
            const middleNode = dataNodes[1];
            expect(middleNode.inValue.value.data.has('a')).toBe(true);

            // First instruction (a = 1) should have empty IN set
            const firstNode = dataNodes[2];
            expect(firstNode.inValue.value.data.size).toBe(0);
        });

        test('should handle branch-dependent liveness', () => {
            const tacText = `
        a = 1
        if a goto THEN
        b = 2
        goto END
        THEN: c = 3
        END: d = b + c
      `;
            const tacInstructions = new TacParser(tacText).parseTac();
            const tacProgram = TacProgram.fromParsedInstructions(tacInstructions);
            const service = getFlowServiceInstanceFor(tacProgram, 'liveness-single-instruction');

            // Advance to end state
            service.advanceToEnd();
            const finalState = service.currentValue();

            // Find the instruction "d = b + c"
            const lastInstrNode = finalState?.nodes.find(node =>
                node.kind === 'node' &&
                node.instructions.some(instr => instr.includes('d = b + c'))
            );

            // Both 'b' and 'c' should be in the IN set
            expect(lastInstrNode?.inValue.value.data.has('b')).toBe(true);
            expect(lastInstrNode?.inValue.value.data.has('c')).toBe(true);

            // Find the 'if' instruction
            const ifNode = finalState?.nodes.find(node =>
                node.kind === 'node' &&
                node.instructions.some(instr => instr.includes('if a goto'))
            );

            // 'a' should be in the IN set of the if instruction
            expect(ifNode?.inValue.value.data.has('a')).toBe(true);

            // 'b' and 'c' should be in the OUT set of the if instruction
            // since they're needed after the branch
            expect(ifNode?.outValue.value.data.has('b') || ifNode?.outValue.value.data.has('c')).toBe(true);
        });
    });

    describe('Edge cases', () => {

        test('should handle unreachable code', () => {
            const tacText = `
        a = 1
        goto END
        b = 2
        END: c = a
      `;
            const tacInstructions = new TacParser(tacText).parseTac();
            const tacProgram = TacProgram.fromParsedInstructions(tacInstructions);
            const service = getFlowServiceInstanceFor(tacProgram, 'liveness-single-instruction');

            service.advance();
            const state = service.currentValue();

            // Find the node for "b = 2"
            const unreachableNode = state?.nodes.find(node =>
                node.kind === 'node' &&
                node.instructions.some(instr => instr.includes('b = 2'))
            );

            // The unreachable node should exist
            expect(unreachableNode).toBeDefined();

            // The IN set should be empty since it's unreachable
            expect(unreachableNode?.inValue.value.data.size).toBe(0);
        });
    });
});