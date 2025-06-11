export default function convertToBasicBlocks(tac) {
    let [first, ...restTac] = tac;
    let leaderIds = new Set([first.id]);
    for (let instr of restTac) {
        if (instr.type === 'jmp' || instr.type === 'cjmp') {
            let target = instr.result.val;
            leaderIds.add(target);
            if (instr !== tac.at(-1)) leaderIds.add(instr.id + 1);
        }
    }
    let leaders = [...leaderIds].sort();
    // push sentinal value for easier slicing
    leaders.push(tac.length);
    let blocks = [];
    for (let i = 0; i < leaders.length - 1; i++) {
        let start = leaders[i];
        let end = leaders[i + 1];
        let blockInstr = tac.slice(start, end);
        blocks.push(new BasicBlock(blockInstr, i));
    }
    for (let i = 0; i < blocks.length; i++) {
        let block = blocks[i];
        let lastInstr = block.instructions.at(-1);
        if (lastInstr === 'cjmp' || lastInstr === 'jmp') {
            let target = lastInstr.result.val;
            // must exist because all instructions are in exactly one block
            let targetBlock = blocks.filter(b => b.instructions.map(i => i.id === target))[0];
            block.addTarget(targetBlock.blockId);
        }
        if (lastInstr !== 'jmp') {
            block.addTarget(block.blockId + 1);
        }
    }
    return blocks;
}

export class BasicBlock {

    blockId;
    instructions;
    targets;

    constructor(instructions, blockId) {
        this.instructions = instructions;
        this.blockId = blockId;
        this.targets = [];
    }

    addTarget(otherBlockId) {
        this.targets.push(otherBlockId);
    }

    toString() {
        return this.instructions.map(i => i.toString()).join('\n');
    }

}


