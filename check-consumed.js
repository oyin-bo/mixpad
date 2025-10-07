const consumed = 4194320;
const length = consumed & 0xFFFFFF;
const kind = consumed & 0x0FF00000;
const flags = consumed & 0xF0000;

console.log('Consumed:', consumed);
console.log('Consumed in hex:', consumed.toString(16));
console.log('Consumed in binary:', consumed.toString(2));
console.log('Length (lower 24 bits):', length);
console.log('Kind (bits 20-27):', kind.toString(16));
console.log('Flags (bits 16-19):', flags.toString(16));
