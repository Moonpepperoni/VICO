import {extractUseAndDefFromBasicBlocks, extractUseAndDefFromInstructions, LivenessAnalysis} from "./liveness.ts";
import {GeneratorStepper} from "./stepper.ts";
import type {SingleInstructionGraph} from "../cfg/single-instruction.ts";
import type {BasicBlockControlFlowGraph} from "../cfg/basic-blocks.ts";
import {extractGenAndKillFromBasicBlocks, ReachingDefinitions} from "./reaching-definitions.ts";
import {ConstantPropagation, extractDefinitions} from "./constant-propagation.ts";
import type {TacInstruction} from "../tac/parser-types.ts";

export type YieldReason = 'initialized' | 'ended' | 'in-computed' | 'out-computed';

export function createLivenessInstructionStepper(cfg: SingleInstructionGraph, liveOut: Set<string>, preComputeStates = 100) {
    const instructions = new Map(cfg.dataNodeIds.map(id => [id, [...cfg.getNodeInstructions(id).values()][0]]));
    const {use, def} = extractUseAndDefFromInstructions(instructions);
    return new GeneratorStepper(LivenessAnalysis({cfg, def, use}, liveOut), preComputeStates);
}

export function createLivenessBasicBlockStepper(cfg: BasicBlockControlFlowGraph, liveOut: Set<string>, preComputeStates = 100) {
    const basicBlocks: Map<number, TacInstruction[]> = new Map();
    for (const id of cfg.dataNodeIds) {
        basicBlocks.set(id, [...cfg.getNodeInstructions(id).values()]);
    }
    const {use, def} = extractUseAndDefFromBasicBlocks(basicBlocks);
    return new GeneratorStepper(LivenessAnalysis({cfg, def, use}, liveOut), preComputeStates);
}

export function createReachingDefinitionsStepper(cfg: BasicBlockControlFlowGraph, preComputeStates = 100) {
    const basicBlocks: Map<number, Map<number, TacInstruction>> = new Map();
    for (const id of cfg.dataNodeIds) {
        basicBlocks.set(id, cfg.getNodeInstructions(id));
    }
    const {genSets, killSets, instructionGenNames} = extractGenAndKillFromBasicBlocks(basicBlocks);
    return new GeneratorStepper(ReachingDefinitions({
        cfg,
        gen: genSets,
        kill: killSets,
        instructionGenNames
    }), preComputeStates);
}

export function createConstantPropagationStepper(cfg: BasicBlockControlFlowGraph, preComputeStates = 100) {
    const basicBlocks: Map<number, TacInstruction[]> = new Map();
    for (const id of cfg.dataNodeIds) {
        basicBlocks.set(id, [...cfg.getNodeInstructions(id).values()]);
    }
    const {definitions} = extractDefinitions(basicBlocks);
    return new GeneratorStepper(ConstantPropagation({cfg, definitions}), preComputeStates);
}