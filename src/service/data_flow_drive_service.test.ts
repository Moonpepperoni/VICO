import {DataFlowDriveService, type FlowAlgorithmSelector} from './data-flow-drive-service';
import {beforeEach, describe, expect, it} from 'vitest';
import {enableMapSet} from "immer";

enableMapSet();

// Sample TAC program for testing
const validTacProgram = `a = 5
  b = 10
  c = a + b`

const invalidTacProgram = `a = 5
  b = 
  c = a + b`;

describe('DataFlowDriveService', () => {
    describe('Program Management', () => {
        it('should initialize with an empty program', () => {
            const service = new DataFlowDriveService('');
            expect(service.programText).toBe('');
            expect(service.errors).toBeUndefined();
        });

        it('should successfully load a valid program', () => {
            const service = new DataFlowDriveService('');
            const errors = service.trySetNewProgram(validTacProgram);

            expect(errors).toEqual([]);
            expect(service.programText).toBe(validTacProgram);
            expect(service.errors).toBeUndefined();
        });

        it('should report errors when loading an invalid program', () => {
            const service = new DataFlowDriveService('');
            const errors = service.trySetNewProgram(invalidTacProgram);

            expect(errors.length).toBeGreaterThan(0);
            expect(service.programText).toBe(invalidTacProgram);
            expect(service.errors).toBeDefined();
            expect(service.errors?.length).toBeGreaterThan(0);
            expect(service.errors?.[0]).toHaveProperty('line');
            expect(service.errors?.[0]).toHaveProperty('reason');
        });
    });

    describe('Algorithm Selection', () => {
        let service: DataFlowDriveService;

        beforeEach(() => {
            service = new DataFlowDriveService('');
            service.trySetNewProgram(validTacProgram);
        });

        it('should have no algorithm selected initially', () => {
            expect(service.currentAlgorithm).toBeUndefined();
        });

        it('should correctly set liveness-single-instruction algorithm', () => {
            const selector: FlowAlgorithmSelector = {
                kind: 'liveness-single-instruction',
                liveOut: new Set(['c'])
            };

            service.trySetAlgorithm(selector);
            expect(service.currentAlgorithm).toBe('liveness-single-instruction');
        });

        it('should correctly set liveness-basic-blocks algorithm', () => {
            const selector: FlowAlgorithmSelector = {
                kind: 'liveness-basic-blocks',
                liveOut: new Set(['c'])
            };

            service.trySetAlgorithm(selector);
            expect(service.currentAlgorithm).toBe('liveness-basic-blocks');
        });

        it('should correctly set reaching-definitions-basic-blocks algorithm', () => {
            const selector: FlowAlgorithmSelector = {
                kind: 'reaching-definitions-basic-blocks'
            };

            service.trySetAlgorithm(selector);
            expect(service.currentAlgorithm).toBe('reaching-definitions-basic-blocks');
        });

        it('should correctly set constant-propagation-basic-blocks algorithm', () => {
            const selector: FlowAlgorithmSelector = {
                kind: 'constant-propagation-basic-blocks'
            };

            service.trySetAlgorithm(selector);
            expect(service.currentAlgorithm).toBe('constant-propagation-basic-blocks');
        });

        it('should allow deselecting the current algorithm', () => {
            const selector: FlowAlgorithmSelector = {
                kind: 'liveness-basic-blocks',
                liveOut: new Set(['c'])
            };

            service.trySetAlgorithm(selector);
            expect(service.currentAlgorithm).toBe('liveness-basic-blocks');

            service.deselectAlgorithm();
            expect(service.currentAlgorithm).toBeUndefined();
        });

        it('should not set algorithm if program is invalid', () => {
            service.trySetNewProgram(invalidTacProgram);

            const selector: FlowAlgorithmSelector = {
                kind: 'liveness-basic-blocks',
                liveOut: new Set(['c'])
            };

            service.trySetAlgorithm(selector);
            expect(service.currentAlgorithm).toBeUndefined();
        });
    });

    describe('Algorithm Execution', () => {
        let service: DataFlowDriveService;

        beforeEach(() => {
            service = new DataFlowDriveService('');
            service.trySetNewProgram(validTacProgram);
            service.trySetAlgorithm({
                kind: 'liveness-basic-blocks',
                liveOut: new Set(['c'])
            });
        });

        it('should have a current value after algorithm selection', () => {
            const currentValue = service.currentStepValue();
            expect(currentValue).toBeDefined();
            expect(currentValue).toHaveProperty('nodes');
            expect(currentValue).toHaveProperty('edges');
            expect(currentValue).toHaveProperty('explanation');
        });

        it('should initially allow stepping forward but not backward', () => {
            expect(service.canStepForward()).toBe(true);
            expect(service.canStepBackward()).toBe(false);
        });

        it('should update state when stepping forward', () => {
            const initialValue = service.currentStepValue();
            service.tryStepForward();
            const newValue = service.currentStepValue();

            expect(newValue).not.toEqual(initialValue);
        });

        it('should allow stepping backward after stepping forward', () => {
            service.tryStepForward();
            expect(service.canStepBackward()).toBe(true);
        });

        it('should restore previous state when stepping backward', () => {
            const initialValue = service.currentStepValue();
            service.tryStepForward();
            service.tryStepBackward();
            const restoredValue = service.currentStepValue();

            expect(restoredValue).toEqual(initialValue);
        });

        it('should reach end state when stepToEnd is called', () => {
            service.stepToEnd();
            expect(service.canStepForward()).toBe(false);
            expect(service.canStepBackward()).toBe(true);
        });

        it('should return undefined when stepping forward at the end', () => {
            service.stepToEnd();
            service.tryStepForward();
            expect(service.currentStepValue()).toBeUndefined();
        });

        it('should do nothing when stepping backward at the beginning', () => {
            const beginValue = service.currentStepValue();
            service.tryStepBackward();
            expect(service.currentStepValue()).toEqual(beginValue);
        });
    });

    describe('Flow State Structure', () => {
        let service: DataFlowDriveService;

        beforeEach(() => {
            service = new DataFlowDriveService(validTacProgram);
            service.trySetAlgorithm({
                kind: 'liveness-basic-blocks',
                liveOut: new Set(['c'])
            });
        });

        it('should have correct structure for FlowState', () => {
            const state = service.currentStepValue();
            expect(state).toBeDefined();
            expect(state).toHaveProperty('nodes');
            expect(state).toHaveProperty('edges');
            expect(state).toHaveProperty('explanation');

            expect(Array.isArray(state?.nodes)).toBe(true);
            expect(Array.isArray(state?.edges)).toBe(true);
        });

        it('should have entry and exit nodes in the flow state', () => {
            const state = service.currentStepValue();

            const entryNode = state?.nodes.find(node => node.kind === 'entry');
            expect(entryNode).toBeDefined();

            const exitNode = state?.nodes.find(node => node.kind === 'exit');
            expect(exitNode).toBeDefined();
        });

        it('should have at least one regular node in the flow state', () => {
            const state = service.currentStepValue();

            const regularNodes = state?.nodes.filter(node => node.kind === 'node');
            expect(regularNodes?.length).toBeGreaterThan(0);

            const firstRegularNode = regularNodes?.[0];
            expect(firstRegularNode).toHaveProperty('instructions');
            expect(firstRegularNode).toHaveProperty('perNodeValues');
        });

        it('should have edges connecting the nodes', () => {
            const state = service.currentStepValue();

            expect(state?.edges.length).toBeGreaterThan(0);

            const firstEdge = state?.edges[0];
            expect(firstEdge).toHaveProperty('src');
            expect(firstEdge).toHaveProperty('target');
            expect(firstEdge).toHaveProperty('isBackEdge');
        });
    });

    describe('Algorithm Changes', () => {
        let service: DataFlowDriveService;

        beforeEach(() => {
            service = new DataFlowDriveService('');
            service.trySetNewProgram(validTacProgram);
        });

        it('should reset state when switching algorithms', () => {
            service.trySetAlgorithm({
                kind: 'liveness-basic-blocks',
                liveOut: new Set(['c'])
            });

            service.tryStepForward();
            service.tryStepForward();

            const livenessState = service.currentStepValue();

            service.trySetAlgorithm({
                kind: 'reaching-definitions-basic-blocks'
            });

            const reachingState = service.currentStepValue();

            expect(reachingState).not.toEqual(livenessState);
            expect(service.canStepBackward()).toBe(false); // Should be at beginning again
        });

        it('should clear current state when deselecting algorithm', () => {
            service.trySetAlgorithm({
                kind: 'liveness-basic-blocks',
                liveOut: new Set(['c'])
            });

            expect(service.currentStepValue()).toBeDefined();

            service.deselectAlgorithm();

            expect(service.currentStepValue()).toBeUndefined();
        });
    });

    describe('Program Changes', () => {
        let service: DataFlowDriveService;

        beforeEach(() => {
            service = new DataFlowDriveService('');
            service.trySetNewProgram(validTacProgram);
            service.trySetAlgorithm({
                kind: 'liveness-basic-blocks',
                liveOut: new Set(['c'])
            });
        });

        it('should reset algorithm when changing program', () => {
            expect(service.currentAlgorithm).toBe('liveness-basic-blocks');

            const newValidProgram = `x = 1
        y = 2
        z = x + y
        return z`;

            service.trySetNewProgram(newValidProgram);

            // should completely reset the algorithm
            expect(service.currentAlgorithm).toBeUndefined();
        });

        it('should return false when program text is empty', () => {
            service.trySetNewProgram('');
            expect(service.programText).toBe('');
            expect(service.canSelectAlgorithm()).toBe(false);
        });

        it('should return false when program is invalid', () => {
            service.trySetNewProgram(invalidTacProgram);
            expect(service.errors).toBeDefined();
            expect(service.canSelectAlgorithm()).toBe(false);
        });

        it('should return true when program is valid', () => {
            service.trySetNewProgram(validTacProgram);
            expect(service.errors).toBeUndefined();
            expect(service.canSelectAlgorithm()).toBe(true);
        });

        it('should return false after setting an invalid program when previously valid', () => {
            service.trySetNewProgram(validTacProgram);
            expect(service.canSelectAlgorithm()).toBe(true);

            service.trySetNewProgram(invalidTacProgram);
            expect(service.canSelectAlgorithm()).toBe(false);
        });

        it('should return true after setting a valid program when previously invalid', () => {
            service.trySetNewProgram(invalidTacProgram);
            expect(service.canSelectAlgorithm()).toBe(false);

            service.trySetNewProgram(validTacProgram);
            expect(service.canSelectAlgorithm()).toBe(true);
        });

    });
});
