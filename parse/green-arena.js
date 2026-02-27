// @ts-check

import { getTokenLength } from './scan-core.js';

/**
 * A flat native JS array representing the Green Arena tree structure.
 * Organized in NODE_STRIDE-sized chunks: [Header, FirstChild, NextSibling, Materialized, ...].
 * Uses native arrays (not typed arrays) for efficient growing and mixed-type materialized data.
 * @typedef {any[]} GreenArena
 */

/** Number of array slots per node in the Green Arena. */
export const NODE_STRIDE = 4;

/** Offset of the Header (ProvisionalToken) slot within a node. */
export const HEADER = 0;

/** Offset of the First Child slot within a node. */
export const FIRST_CHILD = 1;

/** Offset of the Next Sibling slot within a node. */
export const NEXT_SIBLING = 2;

/** Offset of the Materialized Data slot within a node. */
export const MATERIALIZED = 3;

/**
 * Create a new empty arena.
 * Slots 0..3 are reserved as the null sentinel so that index 0 means "no node".
 * @returns {GreenArena}
 */
export function createArena() {
  return [0, 0, 0, null];
}

/**
 * Allocate a new node in the arena and return its index.
 * @param {GreenArena} arena
 * @param {number} header - ProvisionalToken (packed 32-bit: kind + width + flags)
 * @param {number} [firstChild] - Arena index of first child (0 = none)
 * @param {number} [nextSibling] - Arena index of next sibling (0 = none)
 * @param {*} [materialized] - Optional materialized data (string, object, etc.)
 * @returns {number} The arena index of the newly allocated node
 */
export function allocateNode(arena, header, firstChild, nextSibling, materialized) {
  const index = arena.length;
  arena.push(
    header,
    firstChild || 0,
    nextSibling || 0,
    materialized !== undefined ? materialized : null
  );
  return index;
}

/**
 * Get the header (ProvisionalToken) of a node.
 * @param {GreenArena} arena
 * @param {number} index
 * @returns {number}
 */
export function getHeader(arena, index) {
  return arena[index + HEADER];
}

/**
 * Get the first child arena index of a node (0 = no children).
 * @param {GreenArena} arena
 * @param {number} index
 * @returns {number}
 */
export function getFirstChild(arena, index) {
  return arena[index + FIRST_CHILD];
}

/**
 * Get the next sibling arena index of a node (0 = no more siblings).
 * @param {GreenArena} arena
 * @param {number} index
 * @returns {number}
 */
export function getNextSibling(arena, index) {
  return arena[index + NEXT_SIBLING];
}

/**
 * Get the materialized data of a node (null if not materialized).
 * @param {GreenArena} arena
 * @param {number} index
 * @returns {*}
 */
export function getMaterialized(arena, index) {
  return arena[index + MATERIALIZED];
}

/**
 * Set the first child arena index of a node.
 * @param {GreenArena} arena
 * @param {number} index
 * @param {number} childIndex
 */
export function setFirstChild(arena, index, childIndex) {
  arena[index + FIRST_CHILD] = childIndex;
}

/**
 * Set the next sibling arena index of a node.
 * @param {GreenArena} arena
 * @param {number} index
 * @param {number} siblingIndex
 */
export function setNextSibling(arena, index, siblingIndex) {
  arena[index + NEXT_SIBLING] = siblingIndex;
}

/**
 * Set the materialized data of a node.
 * @param {GreenArena} arena
 * @param {number} index
 * @param {*} data
 */
export function setMaterialized(arena, index, data) {
  arena[index + MATERIALIZED] = data;
}

/**
 * Get the total number of nodes in the arena (including the null sentinel at index 0).
 * @param {GreenArena} arena
 * @returns {number}
 */
export function nodeCount(arena) {
  return arena.length / NODE_STRIDE;
}

/**
 * Splice arena nodes: remove a range and optionally insert new raw slots.
 * Used for incremental re-parsing to patch the arena in place.
 * @param {GreenArena} arena
 * @param {number} startIndex - Start arena index (must be a multiple of NODE_STRIDE)
 * @param {number} deleteNodeCount - Number of nodes to remove
 * @param {GreenArena} [newSlots] - Raw slots to insert (length must be a multiple of NODE_STRIDE)
 */
export function spliceNodes(arena, startIndex, deleteNodeCount, newSlots) {
  if (newSlots && newSlots.length > 0) {
    arena.splice(startIndex, deleteNodeCount * NODE_STRIDE, ...newSlots);
  } else {
    arena.splice(startIndex, deleteNodeCount * NODE_STRIDE);
  }
}

/**
 * Count children of a node by following the firstChild → nextSibling chain.
 * @param {GreenArena} arena
 * @param {number} index
 * @returns {number}
 */
export function countChildren(arena, index) {
  let count = 0;
  let child = getFirstChild(arena, index);
  while (child > 0) {
    count++;
    child = getNextSibling(arena, child);
  }
  return count;
}

/**
 * Compute the total width of a node by summing widths of all children.
 * For leaf nodes (no children), returns the width from the header.
 * @param {GreenArena} arena
 * @param {number} index
 * @returns {number}
 */
export function computeWidth(arena, index) {
  const firstChild = getFirstChild(arena, index);
  if (firstChild === 0) {
    return getTokenLength(getHeader(arena, index));
  }
  let total = 0;
  let child = firstChild;
  while (child > 0) {
    total += computeWidth(arena, child);
    child = getNextSibling(arena, child);
  }
  return total;
}
