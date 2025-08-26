import { describe, it, expect } from 'vitest';
import {
  explainConstantPropagation,
  explainLiveness,
  explainReachingDefinitions,
} from './engine';

describe('Explanation Functions', () => {
  
  describe('explainConstantPropagation', () => {
    it('should explain initialization phase correctly', () => {
      const explanation = explainConstantPropagation('initialized');
      expect(explanation).toHaveLength(1);
      expect(explanation[0].kind).toBe('text');
      expect(explanation[0].content).toContain('Initial werden alle In- und Out-Mengen auf die leere Menge gesetzt');
    });

    it('should explain ending phase correctly', () => {
      const explanation = explainConstantPropagation('ended');
      expect(explanation).toHaveLength(2);
      expect(explanation[0].kind).toBe('text');
      expect(explanation[0].content).toContain('keine weiteren Änderungen');
      expect(explanation[1].content).toContain('Algorithmus ist beendet');
    });

    it('should explain in-computation phase correctly', () => {
      const explanation = explainConstantPropagation('in-computed');
      expect(explanation).toHaveLength(1);
      expect(explanation[0].content).toContain('Meet-Operator');
    });

    it('should explain out-computation phase correctly', () => {
      const explanation = explainConstantPropagation('out-computed');
      expect(explanation).toHaveLength(2);
      expect(explanation[0].content).toContain('Meet-Operator');
      expect(explanation[1].content).toContain('neue Out-Menge');
    });

    it('should throw for unknown yield reasons', () => {
      // @ts-expect-error Testing invalid input
      expect(() => explainConstantPropagation('unknown')).toThrow('Unknown yield reason');
    });
  });

  describe('explainLiveness', () => {
    it('should explain initialization phase correctly', () => {
      const explanation = explainLiveness('initialized');
      expect(explanation).toHaveLength(2);
      expect(explanation[0].content).toContain('Initial werden alle In- und Out-Mengen');
      expect(explanation[1].content).toContain('Exit-Knoten');
    });

    it('should explain ending phase correctly', () => {
      const explanation = explainLiveness('ended');
      expect(explanation).toHaveLength(2);
      expect(explanation[0].content).toContain('keine weiteren Änderungen');
    });

    it('should explain in-computation with correct mathematical formula', () => {
      const explanation = explainLiveness('in-computed');
      expect(explanation).toHaveLength(2);
      expect(explanation[0].kind).toBe('text');
      expect(explanation[1].kind).toBe('math');
      expect(explanation[1].content).toContain('\\(in(node) := use(node) \\cup (out(node) - def(node))\\)');
    });

    it('should explain out-computation with correct mathematical formula', () => {
      const explanation = explainLiveness('out-computed');
      expect(explanation).toHaveLength(2);
      expect(explanation[1].content).toContain('\\(out(node) := \\bigcup_{s \\in nachfolger(node)}in(s)\\)');
    });

    it('should throw for unknown yield reasons', () => {
      // @ts-expect-error Testing invalid input
      expect(() => explainLiveness('unknown')).toThrow('Unknown yield reason');
    });
  });

  describe('explainReachingDefinitions', () => {
    it('should explain initialization phase correctly', () => {
      const explanation = explainReachingDefinitions('initialized');
      expect(explanation).toHaveLength(1);
      expect(explanation[0].content).toContain('Initial werden alle In- und Out-Mengen');
    });

    it('should explain ending phase correctly', () => {
      const explanation = explainReachingDefinitions('ended');
      expect(explanation).toHaveLength(2);
      expect(explanation[0].content).toContain('keine weiteren Änderungen');
    });

    it('should explain in-computation with correct mathematical formula', () => {
      const explanation = explainReachingDefinitions('in-computed');
      expect(explanation).toHaveLength(2);
      expect(explanation[1].kind).toBe('math');
      expect(explanation[1].content).toContain('\\(in(node) := \\bigcup_{p \\in vorgaenger(node)}out(p)\\)');
    });

    it('should explain out-computation with correct mathematical formula', () => {
      const explanation = explainReachingDefinitions('out-computed');
      expect(explanation).toHaveLength(2);
      expect(explanation[1].content).toContain('\\(out(node) := gen(node) \\cup (in(node) - kill(node))\\)');
    });

    it('should throw for unknown yield reasons', () => {
      // @ts-expect-error Testing invalid input
      expect(() => explainReachingDefinitions('unknown')).toThrow('Unknown yield reason');
    });
  });
});
