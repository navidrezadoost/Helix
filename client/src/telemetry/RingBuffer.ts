export class RingBuffer<T> {
    private buffer: (T | null)[];
    private capacity: number;
    private head: number = 0;
    private tail: number = 0;
    private _size: number = 0;

    constructor(capacity: number) {
        this.capacity = capacity;
        this.buffer = new Array<T | null>(capacity).fill(null);
    }

    public push(item: T): void {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.capacity;
        
        if (this._size < this.capacity) {
            this._size++;
        } else {
            // Buffer is full; tail moves forward to overwrite oldest
            this.tail = (this.tail + 1) % this.capacity;
        }
    }

    public toArray(): T[] {
        const result: T[] = [];
        let current = this.tail;
        for (let i = 0; i < this._size; i++) {
            result.push(this.buffer[current] as T);
            current = (current + 1) % this.capacity;
        }
        return result;
    }

    public get size(): number {
        return this._size;
    }

    public clear(): void {
        this.buffer.fill(null);
        this.head = 0;
        this.tail = 0;
        this._size = 0;
    }
}
