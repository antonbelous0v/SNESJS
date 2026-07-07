const BANK_SIZE = 0x8000
const LOROM_MAX = 0x400000
const HIROM_MAX = 0x400000

export class RomBank {
  constructor(index, offset, size) {
    this.index = index
    this.offset = offset
    this.size = size
  }

  get used() {
    return this.size
  }

  get free() {
    return BANK_SIZE - this.size
  }
}

export class RomLayout {
  constructor({ mapping, banks, totalBytes, usedBytes }) {
    this.mapping = mapping
    this.banks = banks
    this.totalBytes = totalBytes
    this.usedBytes = usedBytes
  }

  get utilization() {
    return this.totalBytes === 0 ? 0 : this.usedBytes / this.totalBytes
  }
}

export class RomPlanner {
  constructor({ fastRom = true } = {}) {
    this.fastRom = fastRom
  }

  plan(sections, mapping = "auto") {
    const resolved = mapping === "auto" ? this.autoMapping(sections) : mapping
    const banks = this.packSections(sections, resolved)
    const totalBytes = banks.length * BANK_SIZE
    const usedBytes = banks.reduce((sum, bank) => sum + bank.size, 0)
    return new RomLayout({ mapping: resolved, banks, totalBytes, usedBytes })
  }

  autoMapping(sections) {
    const total = sections.reduce((sum, section) => sum + section.size, 0)
    return total <= LOROM_MAX ? "lorom" : "hirom"
  }

  packSections(sections, mapping) {
    const ordered = [...sections].sort((a, b) => b.size - a.size)
    const banks = []
    for (const section of ordered) {
      let placed = false
      for (const bank of banks) {
        if (bank.free >= section.size) {
          section.bank = bank.index
          section.offset = bank.offset + bank.size
          bank.size += section.size
          placed = true
          break
        }
      }
      if (!placed) {
        const bank = new RomBank(banks.length, banks.length * BANK_SIZE, section.size)
        section.bank = bank.index
        section.offset = bank.offset
        banks.push(bank)
      }
    }
    return banks
  }
}

export function chooseRomMapping(sections) {
  const total = sections.reduce((sum, section) => sum + section.size, 0)
  return total <= LOROM_MAX ? "lorom" : "hirom"
}
