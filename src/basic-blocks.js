export default function convertToBasicBlocks(singleBlocks) {
    let [first, ...restBlocks] = singleBlocks;
    let leaderIds = new Set([first.id]);
    for (let block of restBlocks) {
        // must exist
        if (block.jmpTarget) {
            for (let target of block.targets) {
                leaderIds.add(target);
            }
        }
    }
    let leaders = [...leaderIds].sort((a, b) => a - b);
    // push sentinal value for easier slicing
    leaders.push(singleBlocks.length);
    let blocks = [];
    for (let i = 0; i < leaders.length - 1; i++) {
        let start = leaders[i];
        let end = leaders[i + 1];
        let blockInstr = singleBlocks.slice(start, end).flatMap(s => s.instructions);
        if (blockInstr.length == 0) continue;
        blocks.push(new BasicBlock(blockInstr, i));
    }
    for (let i = 0; i < blocks.length; i++) {
        let block = blocks[i];
        let lastInstr = block.instructions.at(-1);
        if (lastInstr.type === 'cjmp' || lastInstr.type === 'jmp') {
            let target = lastInstr.result.val;
            // must exist because all instructions are in exactly one block and the target must be the first instruction
            let targetBlock = blocks.filter(b => b.instructions[0].id === target)[0];
            block.addJmpTarget(targetBlock.id);
        }
        if (lastInstr.type !== 'jmp') {
            block.addNext(block.id + 1);
        }
    }
    return blocks;
}

export class BasicBlock {

    id;
    instructions;
    next;
    jmpTarget;

    constructor(instructions, blockId) {
        this.instructions = instructions;
        this.id = blockId;
        this.next = null;
        this.jmpTarget = null;
    }

    addNext(otherBlockId) {
        this.next = otherBlockId;
    }

    addJmpTarget(otherBlockId) {
        this.jmpTarget = otherBlockId;
    }

    get targets() {
        let targets = [this.next];
        if (this.jmpTarget) {
            targets.push(this.jmpTarget);
        }
        return targets;
    }

    toString() {
        return this.instructions.map(i => i.toString()).join('\n');
    }

}


