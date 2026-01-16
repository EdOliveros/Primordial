import { CellStorage } from "./storage";

/**
 * A Static Quadtree designed for high-performance spatial partitioning.
 * It uses a flat array structure to minimize object creation and garbage collection.
 */
export class StaticQuadtree {
    private readonly MAX_DEPTH = 6;
    private readonly CAPACITY = 8;

    private storage: CellStorage;
    private bounds: { x: number, y: number, w: number, h: number };

    // Nodes storage: [x, y, w, h, isLeaf, firstChildIdx, cellCount, ...cellIndices]
    // For simplicity in this initial version, we will use a recursive structure but 
    // keep references to the Storage indices to achieve O(n log n).

    private children: [StaticQuadtree, StaticQuadtree, StaticQuadtree, StaticQuadtree] | null = null;
    private cellIndices: number[] = [];
    private depth: number;

    constructor(storage: CellStorage, x: number, y: number, w: number, h: number, depth = 0) {
        this.storage = storage;
        this.bounds = { x, y, w, h };
        this.depth = depth;
    }

    /**
     * Clears and rebuilds the quadtree with active cells.
     */
    clear() {
        this.cellIndices = [];
        this.children = null;
    }

    insert(cellIdx: number) {
        const x = this.storage.getX(cellIdx);
        const y = this.storage.getY(cellIdx);

        if (!this.contains(x, y)) return false;

        if (this.children) {
            for (const child of this.children) {
                if (child.insert(cellIdx)) return true;
            }
        }

        this.cellIndices.push(cellIdx);

        if (this.cellIndices.length > this.CAPACITY && this.depth < this.MAX_DEPTH) {
            this.subdivide();
            const oldIndices = this.cellIndices;
            this.cellIndices = [];
            for (const idx of oldIndices) {
                this.insert(idx);
            }
        }

        return true;
    }

    private subdivide() {
        const { x, y, w, h } = this.bounds;
        const hw = w / 2;
        const hh = h / 2;

        this.children = [
            new StaticQuadtree(this.storage, x, y, hw, hh, this.depth + 1),         // NW
            new StaticQuadtree(this.storage, x + hw, y, hw, hh, this.depth + 1),    // NE
            new StaticQuadtree(this.storage, x, y + hh, hw, hh, this.depth + 1),    // SW
            new StaticQuadtree(this.storage, x + hw, y + hh, hw, hh, this.depth + 1) // SE
        ];
    }

    private contains(x: number, y: number): boolean {
        return (
            x >= this.bounds.x &&
            x < this.bounds.x + this.bounds.w &&
            y >= this.bounds.y &&
            y < this.bounds.y + this.bounds.h
        );
    }

    /**
     * Queries cells within a rectangular range.
     */
    queryRange(rx: number, ry: number, rw: number, rh: number, found: number[] = []): number[] {
        if (!this.intersects(rx, ry, rw, rh)) return found;

        for (const idx of this.cellIndices) {
            const cx = this.storage.getX(idx);
            const cy = this.storage.getY(idx);
            if (cx >= rx && cx < rx + rw && cy >= ry && cy < ry + rh) {
                found.push(idx);
            }
        }

        if (this.children) {
            for (const child of this.children) {
                child.queryRange(rx, ry, rw, rh, found);
            }
        }

        return found;
    }

    private intersects(rx: number, ry: number, rw: number, rh: number): boolean {
        return !(
            rx > this.bounds.x + this.bounds.w ||
            rx + rw < this.bounds.x ||
            ry > this.bounds.y + this.bounds.h ||
            ry + rh < this.bounds.y
        );
    }
}
