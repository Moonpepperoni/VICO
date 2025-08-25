import {extractUseAndDefFromBasicBlocks, extractUseAndDefFromInstructions, LivenessAnalysis} from "./liveness.ts";
import {GeneratorStepper} from "./stepper.ts";
import type {SingleInstructionGraph} from "../cfg/single-instruction.ts";
import type {BasicBlockControlFlowGraph} from "../cfg/basic-blocks.ts";
import {extractGenAndKillFromBasicBlocks, ReachingDefinitions} from "./reaching-definitions.ts";
import {ConstantPropagation, extractDefinitions} from "./constant-propagation.ts";

export type YieldReason = 'initialized' | 'ended' | 'in-computed' | 'out-computed';

export function createLivenessInstructionStepper(cfg : SingleInstructionGraph, liveOut : Set<string>, preComputeStates = 100) {
    const instructions = new Map(cfg.dataNodeIds.map(id => [id, cfg.getNodeInstructions(id)![0]]));
    const {use, def} = extractUseAndDefFromInstructions(instructions);
    return new GeneratorStepper(LivenessAnalysis({cfg, def, use}, liveOut), preComputeStates);
}

export function createLivenessBasicBlockStepper(cfg : BasicBlockControlFlowGraph, liveOut : Set<string>, preComputeStates = 100) {
    const instructions = new Map(cfg.dataNodeIds.map(id => [id, cfg.getNodeInstructions(id)!]));
    const {use, def} = extractUseAndDefFromBasicBlocks(instructions);
    return new GeneratorStepper(LivenessAnalysis({cfg, def, use}, liveOut), preComputeStates);
}

export function createReachingDefinitionsStepper(cfg : BasicBlockControlFlowGraph, preComputeStates = 100) {
    const instructions = new Map(cfg.dataNodeIds.map(id => [id, cfg.getNodeInstructions(id)!]));
    const {genSets, killSets} = extractGenAndKillFromBasicBlocks(instructions);
    return new GeneratorStepper(ReachingDefinitions({cfg, gen: genSets, kill: killSets}), preComputeStates);
}

export function createConstantPropagationStepper(cfg: BasicBlockControlFlowGraph, preComputeStates = 100) {
    const instructions = new Map(cfg.dataNodeIds.map(id => [id, cfg.getNodeInstructions(id)!]));
    const {definitions} = extractDefinitions(instructions);
    return new GeneratorStepper(ConstantPropagation({cfg, definitions}), preComputeStates);
}